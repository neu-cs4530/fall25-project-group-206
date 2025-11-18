// server/services/notificationFeed.service.ts
import BookmarkModel from '../models/bookmark.model';
import CommunityModel from '../models/community.model';
import { populateDocument } from '../utils/database.util';
import { buildBackfillNotificationsForUser } from '../utils/backfillNotifications.util';

import type {
  DatabaseCommunity,
  PopulatedDatabaseCollection,
  NotificationItem,
} from '../types/types';

/**
 * Builds a notification feed for a user based on their bookmarked
 * collections and communities.
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

      // Communities: raw DB fetch
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
 * Top-level orchestrator for the notification feed.
 *
 * For now:
 *  - Only includes notifications derived from bookmarks
 *  - Returns a unified, newest-first list
 *
 * Later:
 *  - You can call additional helpers (followers, chat, etc.)
 *    and merge the arrays here.
 */
export const buildNotificationFeedForUser = async (
  username: string,
): Promise<NotificationItem[] | { error: string }> => {
  // 1️⃣ Base source: bookmarks (collections + communities)
  const fromBookmarks = await buildNotificationsFromBookmarks(username);

  if ('error' in fromBookmarks) {
    return fromBookmarks;
  }

  // 2️⃣ Future: merge additional sources here and sort by eventDate.
  //    Example (pseudo-code):
  //    const fromFollowers = await buildNotificationsFromFollowers(username);
  //    const combined = [...fromBookmarks, ...fromFollowers];
  //    combined.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  //    return combined;

  // For now, just return the bookmark-based list.
  return fromBookmarks;
};
