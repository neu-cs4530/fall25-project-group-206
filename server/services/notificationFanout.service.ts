// server/services/notificationFanout.service.ts
import { ObjectId } from 'mongodb';
import BookmarkModel from '../models/bookmark.model';
import CollectionModel from '../models/collection.model';
import NotificationModel from '../models/notification.model';
import emitNotification from '../utils/realtime';

import type {
  PopulatedDatabaseQuestion,
  PopulatedDatabaseAnswer,
  NotificationLocation,
} from '../types/types';

/**
 * Resolve a NotificationLocation string from flags.
 */
function resolveLocation(flags: {
  inCollection: boolean;
  inCommunity: boolean;
}): NotificationLocation {
  if (flags.inCollection && flags.inCommunity) return 'collection/community';
  if (flags.inCollection) return 'collection';
  return 'community';
}

/**
 * Human-readable phrase for where the activity happened.
 *
 * If the question has a populated community with a name, we always say:
 *   the "<name>" community
 *
 * Otherwise we fall back to a generic phrase that includes the location slug
 * (e.g., "your collection").
 */
function describeQuestionLocation(
  location: NotificationLocation,
  question: PopulatedDatabaseQuestion,
): string {
  const communityName = question.community?.name;

  // Prefer explicit community name whenever we have it
  if (communityName && communityName.trim().length > 0) {
    return `the "${communityName}" community`;
  }

  // Fallback: generic wording by location
  if (location === 'collection') return 'your collection';
  if (location === 'collection/community') return 'your collection and community';

  // Default
  return `your ${location}`;
}

/**
 * Internal helper: find all users who should be notified about activity on this question,
 * and track whether they see it via collections and/or communities.
 */
async function computeRecipientsForQuestion(
  question: PopulatedDatabaseQuestion,
): Promise<Map<string, NotificationLocation>> {
  const questionId = question._id as ObjectId;

  // 1. Collections that contain this question
  const collections = await CollectionModel.find({ questions: questionId }).select('_id').exec();
  const collectionIds = collections.map(c => c._id);

  // 2. Bookmarks on those collections and the community (if any)
  const [collectionBookmarks, communityBookmarks] = await Promise.all([
    collectionIds.length
      ? BookmarkModel.find({
          targetType: 'Collection',
          targetId: { $in: collectionIds },
        }).exec()
      : Promise.resolve([]),
    question.community?._id
      ? BookmarkModel.find({
          targetType: 'Community',
          targetId: question.community._id,
        }).exec()
      : Promise.resolve([]),
  ]);

  // 3. Merge into username -> flags
  const byUser = new Map<string, { inCollection: boolean; inCommunity: boolean }>();

  const ensureEntry = (username: string) => {
    if (!byUser.has(username)) {
      byUser.set(username, { inCollection: false, inCommunity: false });
    }
    return byUser.get(username)!;
  };

  for (const b of collectionBookmarks) {
    const entry = ensureEntry(b.username);
    entry.inCollection = true;
  }

  for (const b of communityBookmarks) {
    const entry = ensureEntry(b.username);
    entry.inCommunity = true;
  }

  // 4. Convert flags → NotificationLocation
  const result = new Map<string, NotificationLocation>();
  for (const [username, flags] of byUser.entries()) {
    result.set(username, resolveLocation(flags));
  }

  return result;
}

/**
 * Fan-out for a newly created question.
 * Persists notifications + pings via realtime util.
 */
export async function notifyOnNewQuestion(question: PopulatedDatabaseQuestion): Promise<void> {
  const recipients = await computeRecipientsForQuestion(question);

  if (!recipients.size) return;

  const questionId = question._id as ObjectId;

  const docs = Array.from(recipients.entries()).map(([username, location]) => {
    const locationPhrase = describeQuestionLocation(location, question);

    return {
      user: username,
      actor: question.askedBy,
      message: `${question.askedBy} posted a question "${question.title}" in ${locationPhrase}`,
      eventDate: question.askDateTime,
      targetId: questionId,
      targetType: 'Question' as const,
      location,
      link: `/question/${questionId.toString()}`,
      category: 'question' as const,
      isRead: false,
    };
  });

  await NotificationModel.insertMany(docs);

  for (const [username] of recipients.entries()) {
    emitNotification(username);
  }
}

/**
 * Fan-out for a newly created answer.
 */
export async function notifyOnNewAnswer(
  question: PopulatedDatabaseQuestion,
  answer: PopulatedDatabaseAnswer,
): Promise<void> {
  const recipients = await computeRecipientsForQuestion(question);

  if (!recipients.size) return;

  const questionId = question._id as ObjectId;

  const docs = Array.from(recipients.entries()).map(([username, location]) => {
    const locationPhrase = describeQuestionLocation(location, question);

    return {
      user: username,
      actor: answer.ansBy,
      message: `${answer.ansBy} posted an answer to "${question.title}" in ${locationPhrase}`,
      eventDate: answer.ansDateTime,
      targetId: questionId,
      targetType: 'Answer' as const,
      location,
      link: `/question/${questionId.toString()}`,
      category: 'answer' as const,
      isRead: false,
    };
  });

  await NotificationModel.insertMany(docs);

  for (const [username] of recipients.entries()) {
    emitNotification(username);
  }
}
