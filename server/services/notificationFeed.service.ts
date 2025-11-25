import { ObjectId } from 'mongodb';
import BookmarkModel from '../models/bookmark.model';
import CommunityModel from '../models/community.model';
import { populateDocument } from '../utils/database.util';
import buildBackfillNotificationsForUser from '../utils/backfillNotifications.util';

import type {
  DatabaseCommunity,
  PopulatedDatabaseCollection,
  NotificationItem,
  DatabaseUser,
  PopulatedDatabaseQuestion,
  PopulatedDatabaseAnswer,
  DatabaseNotification,
  NotificationPriority,
} from '../types/types';
import UserModel from '../models/users.model';
import QuestionModel from '../models/questions.model';
import NotificationModel from '../models/notification.model';
import {
  getOrCreatePreferences,
  resolvePriorityForNotification,
  isNotificationMuted,
} from './notificationPreferences.service';

/**
 * Internal helper type: a NotificationItem that always has a `sources` array.
 * `sources` is where we keep track of all origins (e.g., "collection", "community", "following").
 */
type NotificationWithSources = NotificationItem & {
  sources: string[];
};

/**
 * Normalize a NotificationItem into a NotificationWithSources by
 * ensuring `sources` exists and at least contains the current `location`.
 */
const ensureSources = (n: NotificationItem | NotificationWithSources): NotificationWithSources => {
  if ('sources' in n && Array.isArray((n as NotificationWithSources).sources)) {
    return n as NotificationWithSources;
  }

  return {
    ...n,
    sources: [n.location],
  };
};

/**
 * Merge two notifications that correspond to the same underlying event.
 *
 * Rules:
 *  - `sources` = union of sources from both notifications.
 *  - If ANY source is "following", the primary `location` becomes "following".
 *  - Between the two versions, we prefer:
 *      * the one that has "following" as a source when the other does not, OR
 *      * otherwise, the one with the newer `eventDate`.
 */
const mergeNotification = (
  existing: NotificationWithSources | undefined,
  incoming: NotificationItem | NotificationWithSources,
): NotificationWithSources => {
  const normalizedIncoming = ensureSources(incoming);

  if (!existing) {
    return normalizedIncoming;
  }

  const normalizedExisting: NotificationWithSources = existing;

  const mergedSources = Array.from(
    new Set([...normalizedExisting.sources, ...normalizedIncoming.sources]),
  );

  const hasFollowing = mergedSources.includes('following');

  const incomingHasFollowing =
    normalizedIncoming.sources.includes('following') &&
    !normalizedExisting.sources.includes('following');

  const incomingIsNewer =
    normalizedIncoming.eventDate.getTime() >= normalizedExisting.eventDate.getTime();

  const preferIncoming = incomingHasFollowing || incomingIsNewer;
  const base = preferIncoming ? normalizedIncoming : normalizedExisting;

  const existingMeta = normalizedExisting.digestMeta;
  const incomingMeta = normalizedIncoming.digestMeta;

  // Merge digestMeta so we keep collection/community names from backfill
  const mergedDigestMeta =
    existingMeta || incomingMeta
      ? {
          collectionName: incomingMeta?.collectionName ?? existingMeta?.collectionName,
          communityName: incomingMeta?.communityName ?? existingMeta?.communityName,
        }
      : undefined;

  return {
    ...base,
    location: hasFollowing ? 'following' : base.location,
    sources: mergedSources,
    ...(mergedDigestMeta ? { digestMeta: mergedDigestMeta } : {}),
  };
};

/**
 * Builds notifications based on bookmarks (collections + communities).
 *
 * Flow:
 *  1. Load all Collection / Community bookmarks for the user.
 *  2. Hydrate:
 *      - collections via populateDocument (ensures questions + answers populated)
 *      - communities via CommunityModel.find
 *  3. Delegate to buildBackfillNotificationsForUser.
 */
export const buildNotificationsFromBookmarks = async (
  username: string,
): Promise<NotificationItem[] | { error: string }> => {
  try {
    // 1. Only bookmarks that can contribute to the feed
    const bookmarks = await BookmarkModel.find({
      username,
      targetType: { $in: ['Collection', 'Community'] },
    });

    if (!bookmarks || bookmarks.length === 0) {
      return [];
    }

    const collectionTargetIds: string[] = [];
    const communityObjectIds: Array<DatabaseCommunity['_id']> = [];

    for (const b of bookmarks) {
      if (b.targetType === 'Collection') {
        collectionTargetIds.push(b.targetId.toString());
      } else if (b.targetType === 'Community') {
        communityObjectIds.push(b.targetId as DatabaseCommunity['_id']);
      }
    }

    // 2. Hydrate collections and communities in parallel
    const [collections, communities] = await Promise.all([
      // Collections: use populateDocument so questions/answers are already populated
      Promise.all(
        collectionTargetIds.map(async id => {
          const result = await populateDocument(id, 'collection');
          if ('error' in result) {
            return null;
          }
          return result as PopulatedDatabaseCollection;
        }),
      ).then(items => items.filter((c): c is PopulatedDatabaseCollection => c !== null)),

      // Communities: raw DB fetch; tests mock `find` directly
      communityObjectIds.length
        ? (CommunityModel.find({
            _id: { $in: communityObjectIds },
            $or: [{ visibility: 'PUBLIC' }, { visibility: 'PRIVATE', participants: username }],
          }) as unknown as Promise<DatabaseCommunity[]>)
        : Promise.resolve([] as DatabaseCommunity[]),
    ]);

    // 3. Delegate to core backfill builder
    const notifications = await buildBackfillNotificationsForUser(collections, communities);

    // Ensure each has `sources` that at least includes its current location (e.g. "collection" / "community").
    const withSources: NotificationWithSources[] = notifications.map(n => ensureSources(n));

    return withSources;
  } catch (error) {
    return { error: (error as Error).message };
  }
};

/**
 * Builds notifications based on users that `username` is following.
 *
 * For each question and answer authored by a followed user, we emit a
 * NotificationItem with location "following".
 */
export const buildNotificationsFromFollowing = async (
  username: string,
): Promise<NotificationItem[] | { error: string }> => {
  try {
    // Load current user with their "following" populated to usernames.
    const dbUser = (await UserModel.findOne({ username })
      .populate('following', 'username')
      .exec()) as (DatabaseUser & { following: DatabaseUser[] }) | null;

    if (!dbUser) {
      return [];
    }

    const followedUsers = (dbUser.following || []) as Pick<DatabaseUser, 'username'>[];

    const followedUsernames = followedUsers
      .map(u => u.username)
      .filter((name): name is string => Boolean(name));

    if (!followedUsernames.length) {
      return [];
    }

    // Fetch all questions authored by followed users, with answers populated.
    const questions = (await QuestionModel.find({
      askedBy: { $in: followedUsernames },
    })
      .populate('answers')
      .exec()) as unknown as PopulatedDatabaseQuestion[];

    const notifications: NotificationItem[] = [];

    for (const q of questions) {
      const qId = q._id as ObjectId;

      // Question-level notification
      notifications.push({
        actor: q.askedBy,
        message: `Someone you follow, ${q.askedBy}, posted a question "${q.title}".`,
        eventDate: q.askDateTime,
        targetId: qId,
        targetType: 'Question',
        location: 'following',
        category: 'question',
        link: `/question/${qId.toString()}`,
      });

      const answers = (q.answers || []) as PopulatedDatabaseAnswer[];

      for (const ans of answers) {
        notifications.push({
          actor: ans.ansBy,
          message: `Someone you follow, ${ans.ansBy}, posted an answer to "${q.title}".`,
          eventDate: ans.ansDateTime,
          targetId: qId,
          targetType: 'Answer',
          location: 'following',
          category: 'answer',
          link: `/question/${qId.toString()}`,
        });
      }
    }

    // Newest → oldest
    notifications.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

    // Mark all as having "following" as a source.
    const withSources: NotificationWithSources[] = notifications.map(n => ensureSources(n));

    return withSources;
  } catch (error) {
    return { error: (error as Error).message };
  }
};

/**
 * Internal helper: build the merged notification list for a user
 * BEFORE applying preferences (muting / priority).
 *
 * This is shared by:
 *  - buildNotificationFeedForUser (main feed)
 *  - buildNotificationDigestForUser (digest view, including muted)
 */
const buildNotificationBaseForUser = async (
  username: string,
): Promise<NotificationWithSources[]> => {
  // 1) Base source: bookmarks (collections + communities)
  const fromBookmarksResult = await buildNotificationsFromBookmarks(username);
  if ('error' in fromBookmarksResult) {
    throw new Error(fromBookmarksResult.error);
  }

  const bookmarkItems: NotificationWithSources[] = fromBookmarksResult.map(n => ensureSources(n));

  // 2) Following-based Q/A activity
  const fromFollowingResult = await buildNotificationsFromFollowing(username);
  if ('error' in fromFollowingResult) {
    throw new Error(fromFollowingResult.error);
  }

  const followingItems: NotificationWithSources[] = fromFollowingResult.map(n => ensureSources(n));

  // 3) "X started following you" + "direct" events from the Notification collection
  const rawUserDocs = (await NotificationModel.find({
    user: username,
    category: { $in: ['follow', 'direct'] },
  })
    .sort({ eventDate: -1 })
    .lean()
    .exec()) as DatabaseNotification[];

  const userEvents: NotificationItem[] = rawUserDocs.map(doc => ({
    _id: doc._id,
    actor: doc.actor,
    message: doc.message,
    eventDate: doc.eventDate,
    targetId: doc.targetId,
    targetType: doc.targetType,
    location: doc.location,
    link: doc.link,
    category: doc.category,
  }));

  // 4) Filter out self-authored activity from bookmarks + following.
  const filteredBookmarks = bookmarkItems.filter(n => n.actor !== username);
  const filteredFollowing = followingItems.filter(n => n.actor !== username);

  // 5) Merge with precedence using mergeNotification:
  const merged = new Map<string, NotificationWithSources>();

  const makeKey = (n: NotificationItem): string => {
    const targetIdStr = n.targetId.toString();
    const eventMs = n.eventDate.getTime();
    return `${n.targetType}:${targetIdStr}:${n.actor}:${eventMs}`;
  };

  const addToMerged = (n: NotificationItem | NotificationWithSources) => {
    const key = makeKey(n);
    const existing = merged.get(key);
    const mergedNotif = mergeNotification(existing, n);
    merged.set(key, mergedNotif);
  };

  // First, bookmark-based entries
  for (const n of filteredBookmarks) {
    addToMerged(n);
  }

  // Then, following-based Q/A entries
  for (const n of filteredFollowing) {
    addToMerged(n);
  }

  // Finally, follow/direct events
  for (const n of userEvents) {
    addToMerged(n);
  }

  // 6) Build final array, newest → oldest by eventDate
  const combined: NotificationWithSources[] = Array.from(merged.values());
  combined.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  return combined;
};

/**
 * Digest-specific types
 */

type DigestPriority = NotificationPriority | 'muted';

export interface NotificationDigestItem {
  id: string;
  priority: DigestPriority;
  category?: NotificationItem['category'];
  location: NotificationItem['location'];
  count: number;
  label: string;
  notifications: NotificationItem[];
}

export interface NotificationDigestResponse {
  high: NotificationDigestItem[];
  normal: NotificationDigestItem[];
  low: NotificationDigestItem[];
  muted: NotificationDigestItem[];
}

interface NotificationDigestGroupInternal {
  id: string;
  priority: DigestPriority;
  category?: NotificationItem['category'];
  location: NotificationItem['location'];
  notifications: NotificationItem[];
  latestEventMs: number;
  labelContext?: string;
}

interface DigestGroupingResult {
  key: string;
  labelContext?: string;
}

/**
 * Decide how to group a notification in the digest:
 *  - Backfill (bookmarks) → per collection / community name if available
 *  - Following Q/A → per followed user (actor)
 *  - Direct / follow → per actor
 *  - Fallback → by priority + category + location
 */
const computeDigestGrouping = (
  notif: NotificationWithSources,
  effectivePriority: DigestPriority,
): DigestGroupingResult => {
  const category = notif.category ?? 'question';
  const location = notif.location;

  // 1) Bookmark backfill notifications
  if (category === 'backfill') {
    const meta = notif.digestMeta;
    const collectionName = meta?.collectionName?.trim();
    const communityName = meta?.communityName?.trim();

    // Collection-only group
    if (location === 'collection' && collectionName) {
      return {
        key: `${effectivePriority}:backfill:collection:${collectionName}`,
        labelContext: `your bookmarked collection "${collectionName}"`,
      };
    }

    // Community-only group
    if (location === 'community' && communityName) {
      return {
        key: `${effectivePriority}:backfill:community:${communityName}`,
        labelContext: `your bookmarked community "${communityName}"`,
      };
    }

    // Both collection and community contributed
    if (location === 'collection/community') {
      if (collectionName && communityName) {
        return {
          key: `${effectivePriority}:backfill:collection-community:${collectionName}:${communityName}`,
          labelContext: `your bookmarked collection "${collectionName}" and community "${communityName}"`,
        };
      }
      if (collectionName) {
        return {
          key: `${effectivePriority}:backfill:collection:${collectionName}`,
          labelContext: `your bookmarked collection "${collectionName}"`,
        };
      }
      if (communityName) {
        return {
          key: `${effectivePriority}:backfill:community:${communityName}`,
          labelContext: `your bookmarked community "${communityName}"`,
        };
      }
    }
  }

  // 2) Direct messages → group per sender
  if (category === 'direct' || location === 'direct') {
    const actor = notif.actor;
    return {
      key: `${effectivePriority}:direct:${actor}`,
      labelContext: actor,
    };
  }

  // 3) Follow events → group per follower
  if (category === 'follow') {
    const actor = notif.actor;
    return {
      key: `${effectivePriority}:follow:${actor}`,
      labelContext: actor,
    };
  }

  // 4) Questions/answers from people you follow → group per user
  if (location === 'following' && (category === 'question' || category === 'answer')) {
    const actor = notif.actor;
    return {
      key: `${effectivePriority}:${category}:following:${actor}`,
      labelContext: actor,
    };
  }

  // 5) Fallback: old behaviour (priority + category + location)
  return {
    key: `${effectivePriority}:${category}:${location}`,
  };
};

/**
 * Helper to build a human-readable label for a digest group.
 * Example: "5 answers were posted in your communities (muted)"
 */
const buildDigestLabel = (
  count: number,
  category: NotificationItem['category'] | undefined,
  location: NotificationItem['location'],
  priority: DigestPriority,
  context?: string,
): string => {
  const cat = category ?? 'question';

  const defaultLocationLabel = (() => {
    switch (location) {
      case 'collection/community':
        return 'your bookmarked collections and communities';
      case 'collection':
        return 'your bookmarked collections';
      case 'community':
        return 'your bookmarked communities';
      case 'following':
        return 'people you follow';
      case 'direct':
        return 'your direct messages';
      default:
        return location;
    }
  })();

  // 1) Backfill groups: use context if provided (specific collection/community)
  if (cat === 'backfill') {
    const where = context ?? defaultLocationLabel;
    const base = `${count} update${count === 1 ? '' : 's'} in ${where}`;
    if (priority === 'muted') return `${base} (muted for you)`;
    return base;
  }

  // 2) Direct messages / follows with specific actor
  if (cat === 'direct' && context) {
    return `${count} direct message${count === 1 ? '' : 's'} from ${context}`;
  }
  if (cat === 'follow' && context) {
    return `${count} follow event${count === 1 ? '' : 's'} from ${context}`;
  }

  // 3) Following Q/A with specific actor
  if (location === 'following' && context) {
    const noun = cat === 'answer' ? 'answer' : 'question';
    const base = `${count} ${noun}${count === 1 ? '' : 's'} from ${context} (people you follow)`;
    if (priority === 'muted') return `${base} (muted for you)`;
    return base;
  }

  // 4) Generic bookmark-driven groups
  if (cat === 'answer') {
    return `${count} answer${count === 1 ? '' : 's'} were posted in ${defaultLocationLabel}`;
  }
  if (cat === 'question') {
    return `${count} question${count === 1 ? '' : 's'} were posted in ${defaultLocationLabel}`;
  }
  if (cat === 'direct') {
    const base = `${count} direct message${count === 1 ? '' : 's'} arrived`;
    if (priority === 'muted') return `${base} (muted for you)`;
    return base;
  }
  if (cat === 'follow') {
    const base = `${count} follow event${count === 1 ? '' : 's'} occurred`;
    if (priority === 'muted') return `${base} (muted for you)`;
    return base;
  }

  // 5) Fallback
  const base = `${count} notification${count === 1 ? '' : 's'}`;
  if (priority === 'muted') return `${base} (muted for you)`;
  return base;
};

/**
 * Top-level orchestrator for the notification feed.
 *
 * Sources:
 *  - Bookmarks (collections + communities)
 *  - Posts by users you follow (questions + answers)
 *  - Direct "follow" / "direct" events from Notification collection
 *
 * Precedence:
 *  - For the same underlying Q/A event, "following" notifications override
 *    collection/community notifications as the primary `location`, but we keep
 *    all contributing sources in `sources`.
 *
 * Tier muting:
 *  - If muteHighGroups / muteNormalGroups / muteLowGroups is set in prefs,
 *    notifications with that priority are hidden from the **feed**.
 *    They still appear in the digest.
 */
export const buildNotificationFeedForUser = async (
  username: string,
): Promise<NotificationItem[] | { error: string }> => {
  try {
    const combined = await buildNotificationBaseForUser(username);
    const prefs = await getOrCreatePreferences(username);

    const filteredWithPriority: NotificationItem[] = [];

    for (const notif of combined) {
      // 1. Per-notification muting (DND, silent hours, muted users/communities/collections)
      const muted = await isNotificationMuted(notif, prefs);
      if (muted) {
        continue;
      }

      // 2. Resolve effective priority for this notification
      const priority = resolvePriorityForNotification(notif, prefs);

      // 3. Tier muting for the **feed** (not the digest)
      if (
        (priority === 'high' && prefs.muteHighGroups) ||
        (priority === 'normal' && prefs.muteNormalGroups) ||
        (priority === 'low' && prefs.muteLowGroups)
      ) {
        // Skip this notification entirely from the feed
        continue;
      }

      // 4. Keep the notification in the feed with its computed priority
      filteredWithPriority.push({
        ...notif,
        priority,
      });
    }

    return filteredWithPriority;
  } catch (error) {
    return { error: (error as Error).message };
  }
};

/**
 * Digest builder:
 *  - Uses the same base notifications as the main feed
 *  - Classifies each notification as "high", "normal", "low", or "muted"
 *  - Groups by (priority, category, location)
 *  - For each group returns a summary label and the underlying notifications
 */
export const buildNotificationDigestForUser = async (
  username: string,
): Promise<NotificationDigestResponse | { error: string }> => {
  try {
    const combined = await buildNotificationBaseForUser(username);
    const prefs = await getOrCreatePreferences(username);

    const groups = new Map<string, NotificationDigestGroupInternal>();

    for (const rawNotif of combined) {
      const notif = rawNotif as NotificationWithSources;

      // Apply user-level muting (DND, silent hours, muted users/communities/collections)
      const muted = await isNotificationMuted(notif, prefs);

      // If muted by those rules, mark the group as "muted" priority;
      // otherwise use resolved high/normal/low.
      const effectivePriority: DigestPriority = muted
        ? 'muted'
        : resolvePriorityForNotification(notif, prefs);

      const category = notif.category ?? 'question';
      const location = notif.location;
      const eventMs = notif.eventDate.getTime();

      // Decide which digest group this notification belongs to
      const { key: groupKey, labelContext } = computeDigestGrouping(notif, effectivePriority);

      let group = groups.get(groupKey);
      if (!group) {
        group = {
          id: groupKey,
          priority: effectivePriority,
          category,
          location,
          notifications: [],
          latestEventMs: eventMs,
          labelContext,
        };
        groups.set(groupKey, group);
      } else {
        // First non-empty context wins
        if (labelContext && !group.labelContext) {
          group.labelContext = labelContext;
        }

        if (eventMs > group.latestEventMs) {
          group.latestEventMs = eventMs;
        }
      }

      // Store underlying notifications with their per-item priority
      group.notifications.push({
        ...notif,
        priority: muted ? undefined : (effectivePriority as NotificationPriority),
      });
    }

    const response: NotificationDigestResponse = {
      high: [],
      normal: [],
      low: [],
      muted: [],
    };

    for (const group of groups.values()) {
      const count = group.notifications.length;
      const label = buildDigestLabel(
        count,
        group.category,
        group.location,
        group.priority,
        group.labelContext,
      );

      const digestItem: NotificationDigestItem = {
        id: group.id,
        priority: group.priority,
        category: group.category,
        location: group.location,
        count,
        label,
        notifications: group.notifications,
      };

      if (group.priority === 'muted') {
        response.muted.push(digestItem);
      } else if (group.priority === 'high') {
        response.high.push(digestItem);
      } else if (group.priority === 'low') {
        response.low.push(digestItem);
      } else {
        response.normal.push(digestItem);
      }
    }

    // Sort groups in each bucket by latest event date (newest first)
    const sortByLatest = (a: NotificationDigestItem, b: NotificationDigestItem) => {
      const aLatest = Math.max(...a.notifications.map(n => n.eventDate.getTime() || 0));
      const bLatest = Math.max(...b.notifications.map(n => n.eventDate.getTime() || 0));
      return bLatest - aLatest;
    };

    response.high.sort(sortByLatest);
    response.normal.sort(sortByLatest);
    response.low.sort(sortByLatest);
    response.muted.sort(sortByLatest);

    return response;
  } catch (error) {
    return { error: (error as Error).message };
  }
};

export const testInternals = {
  computeDigestGrouping,
  buildDigestLabel,
};
