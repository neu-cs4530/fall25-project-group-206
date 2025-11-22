// FILE: server/services/notificationPreferences.service.ts
/* eslint no-console: "off" */

import mongoose from 'mongoose';
import NotificationPreferencesModel, {
  NotificationPreferences,
} from '../models/notificationPreference.model';
import UserModel from '../models/users.model';
import QuestionModel from '../models/questions.model';
import CollectionModel from '../models/collection.model';

import type { DatabaseUser, NotificationItem, NotificationPriority } from '../types/types';

/**
 * DTO shape we send to / receive from the client.
 * All ObjectIds are converted to strings, Maps are converted to plain objects.
 */
export interface NotificationPreferencesDTO {
  mutedUsers: string[];
  mutedCommunities: string[]; // community ids as strings
  mutedCollections: string[]; // collection ids as strings
  perCategoryLocation: Record<string, NotificationPriority>;
  perCategory: Record<string, NotificationPriority>;
  perLocation: Record<string, NotificationPriority>;
  defaultPriority: NotificationPriority;
}

/**
 * Partial update payload accepted from the client.
 * We treat each field as "replace the entire value if present".
 */
export type NotificationPreferencesUpdate = Partial<NotificationPreferencesDTO>;

/**
 * Convert a NotificationPreferences mongoose document into a plain DTO.
 */
function toDTO(prefs: NotificationPreferences): NotificationPreferencesDTO {
  return {
    mutedUsers: [...prefs.mutedUsers],
    mutedCommunities: prefs.mutedCommunities.map(id => id.toString()),
    mutedCollections: prefs.mutedCollections.map(id => id.toString()),
    perCategoryLocation: Object.fromEntries(prefs.perCategoryLocation ?? []),
    perCategory: Object.fromEntries(prefs.perCategory ?? []),
    perLocation: Object.fromEntries(prefs.perLocation ?? []),
    defaultPriority: prefs.defaultPriority,
  };
}

/**
 * Load or create notification preferences for a given username.
 *
 * Preferences are keyed by user ObjectId in the DB.
 * This returns the raw Mongoose document type (used by backend internals).
 */
export async function getOrCreatePreferences(username: string): Promise<NotificationPreferences> {
  const dbUser = (await UserModel.findOne({ username })
    .select('_id')
    .exec()) as DatabaseUser | null;

  if (!dbUser) {
    // Fallback: ephemeral defaults (not persisted), so the feed still works.
    return {
      // This ObjectId is never saved when there is no user
      user: new mongoose.Types.ObjectId(),
      mutedUsers: [],
      mutedCommunities: [],
      mutedCollections: [],
      perCategoryLocation: new Map(),
      perCategory: new Map(),
      perLocation: new Map(),
      defaultPriority: 'normal',
    } as unknown as NotificationPreferences;
  }

  const userId = dbUser._id as mongoose.Types.ObjectId;

  const existing = (await NotificationPreferencesModel.findOne({
    user: userId,
  }).exec()) as NotificationPreferences | null;

  if (existing) {
    return existing;
  }

  const createdDoc = await NotificationPreferencesModel.create({
    user: userId,
    mutedUsers: [],
    mutedCommunities: [],
    mutedCollections: [],
    perCategoryLocation: {},
    perCategory: {},
    perLocation: {},
    defaultPriority: 'normal',
  });

  return createdDoc as unknown as NotificationPreferences;
}

/**
 * Convenience wrapper: return the user's preferences as a DTO
 * suitable for sending to the client.
 */
export async function getPreferencesDTO(username: string): Promise<NotificationPreferencesDTO> {
  const prefs = await getOrCreatePreferences(username);
  return toDTO(prefs);
}

/**
 * Resolve the priority for a given notification.
 *
 * Precedence:
 *  1. perCategoryLocation: "category:location"
 *  2. perCategory: "category"
 *  3. perLocation: "location"
 *  4. defaultPriority
 */
export function resolvePriorityForNotification(
  notification: NotificationItem,
  prefs: NotificationPreferences,
): NotificationPriority {
  const category = notification.category ?? 'question';
  const location = notification.location;

  const keyCategoryLocation = `${category}:${location}`;

  const fromCategoryLocation = prefs.perCategoryLocation.get(keyCategoryLocation) as
    | NotificationPriority
    | undefined;
  if (fromCategoryLocation) {
    return fromCategoryLocation;
  }

  const fromCategory = prefs.perCategory.get(category) as NotificationPriority | undefined;
  if (fromCategory) {
    return fromCategory;
  }

  const fromLocation = prefs.perLocation.get(location) as NotificationPriority | undefined;
  if (fromLocation) {
    return fromLocation;
  }

  return prefs.defaultPriority;
}

/**
 * Determine whether a notification should be muted for this user.
 *
 * Rules:
 *  - If the actor is in mutedUsers → muted.
 *  - If the question's community is in mutedCommunities → muted.
 *  - If the question is contained in any mutedCollections → muted.
 */
export async function isNotificationMuted(
  notification: NotificationItem,
  prefs: NotificationPreferences,
): Promise<boolean> {
  if (prefs.mutedUsers.includes(notification.actor)) {
    return true;
  }

  const hasMutedCommunities = prefs.mutedCommunities.length > 0;
  const hasMutedCollections = prefs.mutedCollections.length > 0;

  if (!hasMutedCommunities && !hasMutedCollections) {
    return false;
  }

  if (notification.targetType !== 'Question' && notification.targetType !== 'Answer') {
    return false;
  }

  const questionId = notification.targetId as mongoose.Types.ObjectId;

  // Community muting
  if (hasMutedCommunities) {
    const questionDoc = await QuestionModel.findById(questionId).select('community').lean().exec();

    const communityId = questionDoc?.community as mongoose.Types.ObjectId | undefined;

    if (communityId && prefs.mutedCommunities.some(mutedId => mutedId.equals(communityId))) {
      return true;
    }
  }

  // Collection muting
  if (hasMutedCollections) {
    const collections = await CollectionModel.find({
      _id: { $in: prefs.mutedCollections },
      questions: questionId,
    })
      .select('_id')
      .lean()
      .exec();

    if (collections.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Update preferences for a user from a DTO-style payload.
 * All fields present in `update` replace the corresponding value.
 */
export async function updatePreferencesForUser(
  username: string,
  update: NotificationPreferencesUpdate,
): Promise<NotificationPreferencesDTO> {
  const dbUser = (await UserModel.findOne({ username })
    .select('_id')
    .exec()) as DatabaseUser | null;

  if (!dbUser) {
    throw new Error(`User "${username}" not found`);
  }

  const userId = dbUser._id as mongoose.Types.ObjectId;

  let prefsDoc = (await NotificationPreferencesModel.findOne({
    user: userId,
  }).exec()) as NotificationPreferences | null;

  if (!prefsDoc) {
    prefsDoc = (await NotificationPreferencesModel.create({
      user: userId,
      mutedUsers: [],
      mutedCommunities: [],
      mutedCollections: [],
      perCategoryLocation: {},
      perCategory: {},
      perLocation: {},
      defaultPriority: 'normal',
    })) as unknown as NotificationPreferences;
  }

  if (update.mutedUsers) {
    prefsDoc.mutedUsers = [...update.mutedUsers];
  }

  if (update.mutedCommunities) {
    prefsDoc.mutedCommunities = update.mutedCommunities.map(id => new mongoose.Types.ObjectId(id));
  }

  if (update.mutedCollections) {
    prefsDoc.mutedCollections = update.mutedCollections.map(id => new mongoose.Types.ObjectId(id));
  }

  if (update.perCategoryLocation) {
    prefsDoc.perCategoryLocation = new Map(Object.entries(update.perCategoryLocation));
  }

  if (update.perCategory) {
    prefsDoc.perCategory = new Map(Object.entries(update.perCategory));
  }

  if (update.perLocation) {
    prefsDoc.perLocation = new Map(Object.entries(update.perLocation));
  }

  if (update.defaultPriority) {
    prefsDoc.defaultPriority = update.defaultPriority;
  }

  await (prefsDoc as unknown as mongoose.Document).save();

  return toDTO(prefsDoc);
}
