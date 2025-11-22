/* eslint no-console: "off" */

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
} from '../types/types';
import UserModel from '../models/users.model';
import QuestionModel from '../models/questions.model';
import NotificationModel from '../models/notification.model';

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

  return {
    ...base,
    location: hasFollowing ? 'following' : base.location,
    sources: mergedSources,
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
    console.log(`[NOTIF][Bookmarks] Building notifications from bookmarks for user="${username}"`);

    // 1. Only bookmarks that can contribute to the feed
    const bookmarks = await BookmarkModel.find({
      username,
      targetType: { $in: ['Collection', 'Community'] },
    });

    console.log(
      `[NOTIF][Bookmarks] Found ${bookmarks?.length ?? 0} bookmark(s) for user="${username}"`,
    );

    if (!bookmarks || bookmarks.length === 0) {
      console.log('[NOTIF][Bookmarks] No bookmarks found, returning empty array.');
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

    console.log(
      `[NOTIF][Bookmarks] Collection IDs=${collectionTargetIds.length}, Community IDs=${communityObjectIds.length}`,
    );

    // 2. Hydrate collections and communities in parallel
    const [collections, communities] = await Promise.all([
      // Collections: use populateDocument so questions/answers are already populated
      Promise.all(
        collectionTargetIds.map(async id => {
          const result = await populateDocument(id, 'collection');
          if ('error' in result) {
            console.log(
              `[NOTIF][Bookmarks] populateDocument error for collection id="${id}": ${result.error}`,
            );
            return null;
          }
          return result as PopulatedDatabaseCollection;
        }),
      ).then(items => items.filter((c): c is PopulatedDatabaseCollection => c !== null)),

      // Communities: raw DB fetch; tests mock `find` directly
      communityObjectIds.length
        ? (CommunityModel.find({ _id: { $in: communityObjectIds } }) as unknown as Promise<
            DatabaseCommunity[]
          >)
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
 * Top-level orchestrator for the notification feed.
 *
 * Sources:
 *  - Bookmarks (collections + communities)
 *  - Posts by users you follow (questions + answers)
 *  - Direct "follow" events (X started following you) from Notification collection
 *
 * Precedence:
 *  - For the same underlying Q/A event, "following" notifications override
 *    collection/community notifications as the primary `location`, but we keep
 *    all contributing sources in `sources`.
 */
export const buildNotificationFeedForUser = async (
  username: string,
): Promise<NotificationItem[] | { error: string }> => {
  try {
    // 1) Base source: bookmarks (collections + communities)
    const fromBookmarksResult = await buildNotificationsFromBookmarks(username);
    if ('error' in fromBookmarksResult) {
      return fromBookmarksResult;
    }

    // Normalize to NotificationWithSources to be safe
    const bookmarkItems: NotificationWithSources[] = fromBookmarksResult.map(n => ensureSources(n));

    // 2) Following-based Q/A activity
    const fromFollowingResult = await buildNotificationsFromFollowing(username);
    if ('error' in fromFollowingResult) {
      return fromFollowingResult;
    }

    const followingItems: NotificationWithSources[] = fromFollowingResult.map(n =>
      ensureSources(n),
    );

    // 3) "X started following you" events from the Notification collection
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
    // This prevents "you posted ..." notifications when looking at your own feed
    // AND stops those events from powering the popup toast.
    const filteredBookmarks = bookmarkItems.filter(n => n.actor !== username);
    const filteredFollowing = followingItems.filter(n => n.actor !== username);

    // 5) Merge with precedence using mergeNotification:
    //    - union of `sources`
    //    - if any source is "following", location becomes "following"
    //    - tie-breaking by "following" vs non-following, then by eventDate
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

    // Then, following-based Q/A entries (they will "win" as location='following'
    // when the same event is also present via bookmarks)
    for (const n of filteredFollowing) {
      addToMerged(n);
    }

    // Finally, follow-you events (targetType === 'User') simply add in
    for (const n of userEvents) {
      addToMerged(n);
    }

    // 6) Build final array, newest → oldest by eventDate
    const combined: NotificationItem[] = Array.from(merged.values());
    combined.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

    return combined;
  } catch (error) {
    return { error: (error as Error).message };
  }
};
