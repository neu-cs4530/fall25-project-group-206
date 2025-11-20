// server/services/notificationFeed.service.ts
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
    }); // NOTE: no `.exec()` here

    if (!bookmarks || bookmarks.length === 0) {
      return [];
    }

    const collectionTargetIds: string[] = [];
    const communityObjectIds: Array<DatabaseCommunity['_id']> = [];

    for (const b of bookmarks) {
      if (b.targetType === 'Collection') {
        // populateDocument expects string id
        collectionTargetIds.push(b.targetId.toString());
      } else if (b.targetType === 'Community') {
        // keep ObjectId for CommunityModel.find
        communityObjectIds.push(b.targetId as DatabaseCommunity['_id']);
      }
    }

    // 2. Hydrate collections and communities in parallel
    const [collections, communities] = await Promise.all([
      // Collections: use populateDocument so questions/answers are already populated
      Promise.all(
        collectionTargetIds.map(async id => {
          const result = await populateDocument(id, 'collection');
          return 'error' in result ? null : (result as PopulatedDatabaseCollection);
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

    return notifications;
  } catch (error) {
    return { error: (error as Error).message };
  }
};

/**
 * Builds notifications based on users that `username` is following.
 *
 * For each question and answer authored by a followed user, we emit a
 * NotificationItem with location "following". These will later override
 * bookmark-based notifications for the same underlying event.
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

    return notifications;
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
 *    collection/community notifications.
 */
export const buildNotificationFeedForUser = async (
  username: string,
): Promise<NotificationItem[] | { error: string }> => {
  try {
    // 1) Base source: bookmarks
    const fromBookmarks = await buildNotificationsFromBookmarks(username);
    if ('error' in fromBookmarks) {
      return fromBookmarks;
    }

    // 2) Following-based Q/A activity
    const fromFollowing = await buildNotificationsFromFollowing(username);
    if ('error' in fromFollowing) {
      return fromFollowing;
    }

    // 3) "X started following you" events from the Notification collection
    const rawFollowDocs = (await NotificationModel.find({
      user: username,
      category: 'follow',
    })
      .sort({ eventDate: -1 })
      .lean()
      .exec()) as DatabaseNotification[];

    const fromFollowEvents: NotificationItem[] = rawFollowDocs.map(doc => ({
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

    // 4) Merge with precedence: following-based Q/A notifications
    // override bookmark-based ones for the same underlying event.
    const merged = new Map<string, NotificationItem>();

    const makeKey = (n: NotificationItem): string => {
      const targetIdStr = n.targetId.toString();
      const eventMs = n.eventDate.getTime();

      // Key is purely about the underlying event, not category.
      return `${n.targetType}:${targetIdStr}:${n.actor}:${eventMs}`;
    };

    // First, bookmark-based entries
    for (const n of fromBookmarks) {
      merged.set(makeKey(n), n);
    }

    // Then, following-based Q/A entries override those
    for (const n of fromFollowing) {
      merged.set(makeKey(n), n);
    }

    // Finally, follow-you events (targetType === 'User') simply add in
    for (const n of fromFollowEvents) {
      merged.set(makeKey(n), n);
    }

    const combined = Array.from(merged.values());
    combined.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

    return combined;
  } catch (error) {
    return { error: (error as Error).message };
  }
};
