// server/tests/services/notificationFeed.service.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CommunityModel from '../../models/community.model';
import { populateDocument } from '../../utils/database.util';
import { buildBackfillNotificationsForUser } from '../../utils/backfillNotifications.util';
import * as NotificationFeedService from '../../services/notificationFeed.service';

import type { PopulatedDatabaseCollection } from '../../../shared/types/collection';
import type { DatabaseCommunity } from '../../../shared/types/community';
import type { NotificationItem } from '../../../shared/types/notification';

jest.mock('../../models/bookmark.model');
jest.mock('../../models/community.model');
jest.mock('../../utils/database.util');
jest.mock('../../utils/backfillNotifications.util');

const { buildNotificationsFromBookmarks, buildNotificationFeedForUser } = NotificationFeedService;

describe('buildNotificationsFromBookmarks', () => {
  const username = 'feedUser';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty array when there are no collection/community bookmarks', async () => {
    (BookmarkModel.find as jest.Mock).mockResolvedValueOnce([]);

    const result = await buildNotificationsFromBookmarks(username);

    expect(result).toEqual([]);
    expect(BookmarkModel.find).toHaveBeenCalledWith({
      username,
      targetType: { $in: ['Collection', 'Community'] },
    });
    expect(populateDocument).not.toHaveBeenCalled();
    expect(CommunityModel.find).not.toHaveBeenCalled();
    expect(buildBackfillNotificationsForUser).not.toHaveBeenCalled();
  });

  test('loads bookmarked collections and communities and delegates to backfill util', async () => {
    const collectionId1 = new mongoose.Types.ObjectId();
    const collectionId2 = new mongoose.Types.ObjectId();
    const communityId = new mongoose.Types.ObjectId();

    const mockBookmarks = [
      {
        username,
        targetId: collectionId1,
        targetType: 'Collection' as const,
      },
      {
        username,
        targetId: collectionId2,
        targetType: 'Collection' as const,
      },
      {
        username,
        targetId: communityId,
        targetType: 'Community' as const,
      },
    ];

    (BookmarkModel.find as jest.Mock).mockResolvedValueOnce(mockBookmarks);

    const coll1: PopulatedDatabaseCollection = {
      _id: collectionId1,
      name: 'C1',
      description: 'Collection 1',
      username,
      isPrivate: false,
      questions: [],
    };

    const coll2: PopulatedDatabaseCollection = {
      _id: collectionId2,
      name: 'C2',
      description: 'Collection 2',
      username,
      isPrivate: false,
      questions: [],
    };

    (populateDocument as jest.Mock).mockResolvedValueOnce(coll1).mockResolvedValueOnce(coll2);

    const community: DatabaseCommunity = {
      _id: communityId,
      name: 'My Community',
      description: 'desc',
      visibility: 'PUBLIC',
      participants: [username],
      admin: username,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    (CommunityModel.find as jest.Mock).mockResolvedValueOnce([community]);

    const mockNotifications: NotificationItem[] = [
      {
        actor: 'userA',
        message: 'userA posted question',
        eventDate: new Date('2024-02-01T00:00:00Z'),
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'Question',
        location: 'collection',
        category: 'backfill',
      },
    ];

    (buildBackfillNotificationsForUser as jest.Mock).mockResolvedValueOnce(mockNotifications);

    const result = await buildNotificationsFromBookmarks(username);

    // Bookmarks query
    expect(BookmarkModel.find).toHaveBeenCalledWith({
      username,
      targetType: { $in: ['Collection', 'Community'] },
    });

    // Collections via populateDocument
    expect(populateDocument).toHaveBeenCalledTimes(2);
    expect(populateDocument).toHaveBeenNthCalledWith(1, collectionId1.toString(), 'collection');
    expect(populateDocument).toHaveBeenNthCalledWith(2, collectionId2.toString(), 'collection');

    // Communities via CommunityModel.find
    expect(CommunityModel.find).toHaveBeenCalledWith({
      _id: { $in: [communityId] },
    });

    // Delegation to backfill util
    expect(buildBackfillNotificationsForUser).toHaveBeenCalledWith([coll1, coll2], [community]);

    // Final result is whatever backfill util returned
    expect(result).toEqual(mockNotifications);
  });

  test('returns error object when an exception is thrown', async () => {
    (BookmarkModel.find as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const result = await buildNotificationsFromBookmarks(username);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('DB error');
    }
  });
});

describe('buildNotificationFeedForUser (aggregator)', () => {
  const username = 'feedUser';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns notifications from bookmarks when successful', async () => {
    const mockNotifications: NotificationItem[] = [
      {
        actor: 'userB',
        message: 'userB posted answer',
        eventDate: new Date('2024-03-01T00:00:00Z'),
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'Answer',
        location: 'community',
        category: 'backfill',
      },
    ];

    const spy = jest
      .spyOn(NotificationFeedService, 'buildNotificationsFromBookmarks')
      .mockResolvedValueOnce(mockNotifications);

    const result = await buildNotificationFeedForUser(username);

    expect(spy).toHaveBeenCalledWith(username);
    expect(result).toBe(mockNotifications);
  });

  test('passes through error from buildNotificationsFromBookmarks', async () => {
    const errorResult = { error: 'bookmark source failed' };

    const spy = jest
      .spyOn(NotificationFeedService, 'buildNotificationsFromBookmarks')
      .mockResolvedValueOnce(errorResult);

    const result = await buildNotificationFeedForUser(username);

    expect(spy).toHaveBeenCalledWith(username);
    expect(result).toEqual(errorResult);
  });
});
