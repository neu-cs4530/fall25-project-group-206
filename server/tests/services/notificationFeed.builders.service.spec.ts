// server/tests/services/notificationFeed.builders.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CommunityModel from '../../models/community.model';
import UserModel from '../../models/users.model';
import QuestionModel from '../../models/questions.model';
import NotificationModel from '../../models/notification.model';
import NotificationPreferencesModel from '../../models/notificationPreference.model';
import { populateDocument } from '../../utils/database.util';
import buildBackfillNotificationsForUser from '../../utils/backfillNotifications.util';

import {
  buildNotificationsFromBookmarks,
  buildNotificationsFromFollowing,
  buildNotificationFeedForUser,
  buildNotificationDigestForUser,
  testInternals,
} from '../../services/notificationFeed.service';

import type {
  DatabaseCommunity,
  PopulatedDatabaseCollection,
  PopulatedDatabaseQuestion,
  PopulatedDatabaseAnswer,
  NotificationItem,
  DatabaseUser,
} from '../../types/types';

jest.mock('../../utils/database.util', () => ({
  __esModule: true,
  populateDocument: jest.fn(),
}));

jest.mock('../../utils/backfillNotifications.util', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const populateDocumentMock = populateDocument as jest.Mock;
const buildBackfillMock = buildBackfillNotificationsForUser as jest.Mock;
const { computeDigestGrouping, buildDigestLabel } = testInternals;

/**
 * Helper to narrow NotificationItem[] | { error: string } into NotificationItem[]
 * and fail the test loudly if an error is returned.
 */
function expectNotifications(value: NotificationItem[] | { error: string }): NotificationItem[] {
  if ('error' in value) {
    throw new Error(`Unexpected error: ${value.error}`);
  }
  return value;
}

describe('notificationFeed.service – builders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('buildNotificationsFromBookmarks', () => {
    it('returns [] when user has no collection/community bookmarks', async () => {
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([] as any);

      const result = await buildNotificationsFromBookmarks('alice');

      expect(BookmarkModel.find).toHaveBeenCalledWith({
        username: 'alice',
        targetType: { $in: ['Collection', 'Community'] },
      });
      expect(result).toEqual([]);
    });

    it('hydrates collections/communities and delegates to backfill builder', async () => {
      const collId = new mongoose.Types.ObjectId();
      const commId = new mongoose.Types.ObjectId();

      // Bookmarks: one collection + one community
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([
        {
          username: 'alice',
          targetId: collId,
          targetType: 'Collection',
        },
        {
          username: 'alice',
          targetId: commId,
          targetType: 'Community',
        },
      ] as any);

      const hydratedCollection: PopulatedDatabaseCollection = {
        _id: collId,
        name: 'My Collection',
        description: 'desc',
        questions: [],
        username: 'alice',
        isPrivate: false,
      } as any;

      const hydratedCommunity: DatabaseCommunity = {
        _id: commId,
        name: 'My Community',
        description: 'community desc',
        visibility: 'PUBLIC',
        participants: [],
        admin: 'alice',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      populateDocumentMock.mockImplementation(async (id: string, type: string) => {
        if (type === 'collection' && id === collId.toString()) {
          return hydratedCollection;
        }
        return { error: 'not used' };
      });

      jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([hydratedCommunity] as any);

      const fakeNotifications: NotificationItem[] = [
        {
          actor: 'bob',
          message: 'bob posted a question',
          eventDate: new Date('2024-01-01T00:00:00Z'),
          targetId: new mongoose.Types.ObjectId(),
          targetType: 'Question',
          location: 'collection',
          category: 'question',
          link: '/question/123',
        },
      ];

      buildBackfillMock.mockResolvedValueOnce(fakeNotifications);

      const raw = await buildNotificationsFromBookmarks('alice');
      const result = expectNotifications(raw);

      // populateDocument should be called for the collection bookmark
      expect(populateDocumentMock).toHaveBeenCalledWith(collId.toString(), 'collection');

      // CommunityModel.find should be called
      expect(CommunityModel.find).toHaveBeenCalledTimes(1);
      expect(buildBackfillMock).toHaveBeenCalledWith([hydratedCollection], [hydratedCommunity]);

      // Service may add extra fields, so partial match is sufficient
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject(fakeNotifications[0]);

      // ensureSources was applied – sources should exist and include location
      expect((result[0] as any).sources).toEqual(['collection']);
    });

    it('returns { error } when an exception is thrown', async () => {
      jest.spyOn(BookmarkModel, 'find').mockRejectedValueOnce(new Error('boom'));

      const result = await buildNotificationsFromBookmarks('alice');

      expect(result).toEqual({ error: 'boom' });
    });
  });

  describe('buildNotificationsFromFollowing', () => {
    it('returns [] when user is not found', async () => {
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await buildNotificationsFromFollowing('alice');

      expect(result).toEqual([]);
    });

    it('returns [] when user follows nobody', async () => {
      const fakeUser: DatabaseUser & { following: DatabaseUser[] } = {
        _id: new mongoose.Types.ObjectId(),
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUser),
      } as any);

      const result = await buildNotificationsFromFollowing('alice');

      expect(result).toEqual([]);
    });

    it('builds notifications for questions and answers authored by followed users', async () => {
      const followedUser: DatabaseUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'bob',
        email: 'bob@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const fakeUser: DatabaseUser & { following: DatabaseUser[] } = {
        _id: new mongoose.Types.ObjectId(),
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [followedUser],
      } as any;

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUser),
      } as any);

      const qId = new mongoose.Types.ObjectId();
      const question: PopulatedDatabaseQuestion = {
        _id: qId,
        title: 'Followed question',
        text: 'body',
        askedBy: 'bob',
        askDateTime: new Date('2024-01-01T10:00:00Z'),
        answers: [],
        tags: [],
        comments: [],
        views: [],
        upVotes: [],
        downVotes: [],
        community: null,
      } as any;

      const answer: PopulatedDatabaseAnswer = {
        _id: new mongoose.Types.ObjectId(),
        text: 'answer body',
        ansBy: 'bob',
        ansDateTime: new Date('2024-01-02T10:00:00Z'),
        comments: [],
      } as any;

      (question as any).answers = [answer];

      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([question]),
      } as any);

      const raw = await buildNotificationsFromFollowing('alice');
      const result = expectNotifications(raw);

      // Expect two notifications: one for the question, one for the answer
      expect(result).toHaveLength(2);

      const [first, second] = result;

      // Sorted newest → oldest, so answer first
      expect(first.targetType).toBe('Answer');
      expect(first.actor).toBe('bob');
      expect(first.location).toBe('following');
      expect(first.message).toContain('posted an answer');
      expect(first.message).toContain('Followed question');

      expect(second.targetType).toBe('Question');
      expect(second.actor).toBe('bob');
      expect(second.location).toBe('following');
      expect(second.message).toContain('posted a question');
      expect(second.message).toContain('Followed question');

      // ensureSources was applied – sources should exist and include 'following'
      expect((first as any).sources).toEqual(['following']);
      expect((second as any).sources).toEqual(['following']);
    });

    it('returns { error } when an exception is thrown', async () => {
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('crash')),
      } as any);

      const result = await buildNotificationsFromFollowing('alice');

      expect(result).toEqual({ error: 'crash' });
    });
  });

  describe('buildNotificationFeedForUser', () => {
    it('returns { error } when underlying notification base throws', async () => {
      // Cause buildNotificationsFromBookmarks -> { error } -> base to throw
      jest.spyOn(BookmarkModel, 'find').mockRejectedValueOnce(new Error('boom'));

      const result = await buildNotificationFeedForUser('alice');

      expect(result).toEqual({ error: 'boom' });
    });

    it('builds feed with priorities when nothing is muted', async () => {
      const userId = new mongoose.Types.ObjectId();

      // First call: for buildNotificationsFromFollowing (user with no following)
      const userFindSpy = jest.spyOn(UserModel, 'findOne');
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
          email: 'alice@example.com',
          password: 'hashed',
          dateJoined: new Date(),
          followers: [],
          following: [],
        } as any),
      } as any);

      // Second call: for getOrCreatePreferences
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
        } as any),
      } as any);

      // No bookmarks
      jest.spyOn(BookmarkModel, 'find').mockResolvedValue([] as any);

      // No questions from following
      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      // One follow notification from Notification collection
      const eventDate = new Date('2024-01-01T10:00:00Z');
      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            user: 'alice',
            actor: 'bob',
            message: 'bob followed you',
            eventDate,
            targetId: new mongoose.Types.ObjectId(),
            targetType: 'User',
            location: 'following',
            link: '/user/bob',
            category: 'follow',
          },
        ]),
      } as any);

      // Preferences: nothing muted, default priority "normal"
      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          user: userId,
          mutedUsers: [],
          mutedCommunities: [],
          mutedCollections: [],
          perCategoryLocation: new Map(),
          perCategory: new Map(),
          perLocation: new Map(),
          defaultPriority: 'normal',
          dndEnabled: false,
          silentHours: { start: null, end: null },
          muteHighGroups: false,
          muteNormalGroups: false,
          muteLowGroups: false,
        } as any),
      } as any);

      const result = await buildNotificationFeedForUser('alice');

      expect(Array.isArray(result)).toBe(true);
      const feed = result as NotificationItem[];

      expect(feed).toHaveLength(1);
      expect(feed[0]).toMatchObject({
        actor: 'bob',
        location: 'following',
        category: 'follow',
      });
      expect((feed[0] as any).priority).toBe('normal');
    });

    it('suppresses notifications when the resolved priority tier is muted', async () => {
      const userId = new mongoose.Types.ObjectId();

      // First UserModel.findOne: for buildNotificationsFromFollowing (user with no following)
      const userFindSpy = jest.spyOn(UserModel, 'findOne');
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
          email: 'alice@example.com',
          password: 'hashed',
          dateJoined: new Date(),
          followers: [],
          following: [], // no following → following builder returns []
        } as any),
      } as any);

      // Second UserModel.findOne: for getOrCreatePreferences
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
        } as any),
      } as any);

      // No bookmarks → bookmarks builder returns []
      jest.spyOn(BookmarkModel, 'find').mockResolvedValue([] as any);

      // No questions from followed users
      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      // One notification document (e.g. follow event) so we exercise the full feed path
      const eventDate = new Date('2024-01-01T10:00:00Z');
      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            user: 'alice',
            actor: 'bob',
            message: 'bob followed you',
            eventDate,
            targetId: new mongoose.Types.ObjectId(),
            targetType: 'User',
            location: 'following',
            link: '/user/bob',
            category: 'follow',
          },
        ]),
      } as any);

      // Preferences: default priority "normal" but normal tier is muted
      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          user: userId,
          mutedUsers: [],
          mutedCommunities: [],
          mutedCollections: [],
          perCategoryLocation: new Map(),
          perCategory: new Map(),
          perLocation: new Map(),
          defaultPriority: 'normal', // resolved priority
          dndEnabled: false,
          silentHours: { start: null, end: null },
          muteHighGroups: false,
          muteNormalGroups: true, // this tier is muted
          muteLowGroups: false,
        } as any),
      } as any);

      const result = await buildNotificationFeedForUser('alice');

      // Because the only notification resolves to priority "normal"
      // and muteNormalGroups is true, the feed should be empty.
      expect(result).toEqual([]);
    });

    it('merges bookmark and following notifications for the same event and prefers following location', async () => {
      const userId = new mongoose.Types.ObjectId();
      const collId = new mongoose.Types.ObjectId();
      const questionId = new mongoose.Types.ObjectId();
      const eventDate = new Date('2024-01-01T12:00:00Z');

      // Bookmarks exist to trigger backfill
      jest.spyOn(BookmarkModel, 'find').mockResolvedValue([
        {
          username: 'alice',
          targetId: collId,
          targetType: 'Collection',
        },
      ] as any);

      // populateDocument not really used here; allow it to return an error
      populateDocumentMock.mockResolvedValue({ error: 'ignored' });

      // Backfill returns one "backfill" notification for the question
      const bookmarkNotif: NotificationItem & {
        digestMeta?: { collectionName?: string; communityName?: string };
      } = {
        actor: 'bob',
        message: 'backfill update',
        eventDate,
        targetId: questionId as any,
        targetType: 'Question',
        location: 'collection',
        category: 'backfill',
        link: `/question/${questionId.toString()}`,
        digestMeta: {
          collectionName: 'My Collection',
          communityName: 'My Community',
        },
      };

      buildBackfillMock.mockResolvedValueOnce([bookmarkNotif]);

      // First UserModel.findOne: for following
      const userFindSpy = jest.spyOn(UserModel, 'findOne');
      const followedUser: DatabaseUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'bob',
        email: 'bob@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const fakeUserWithFollowing: DatabaseUser & { following: DatabaseUser[] } = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [followedUser],
      } as any;

      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUserWithFollowing),
      } as any);

      // Questions for "bob" – same questionId and eventDate as backfill notif
      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: questionId,
            title: 'Same question',
            text: 'body',
            askedBy: 'bob',
            askDateTime: eventDate,
            answers: [],
            tags: [],
            comments: [],
            views: [],
            upVotes: [],
            downVotes: [],
            community: null,
          },
        ]),
      } as any);

      // Second UserModel.findOne: for getOrCreatePreferences
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
        } as any),
      } as any);

      // No direct/follow events
      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      // Preferences: default Priority normal, nothing muted
      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          user: userId,
          mutedUsers: [],
          mutedCommunities: [],
          mutedCollections: [],
          perCategoryLocation: new Map(),
          perCategory: new Map(),
          perLocation: new Map(),
          defaultPriority: 'normal',
          dndEnabled: false,
          silentHours: { start: null, end: null },
          muteHighGroups: false,
          muteNormalGroups: false,
          muteLowGroups: false,
        } as any),
      } as any);

      const result = await buildNotificationFeedForUser('alice');
      const feed = result as NotificationItem[];

      // Only one merged notification
      expect(feed).toHaveLength(1);

      const merged = feed[0] as any;

      // Location should be "following" due to source precedence
      expect(merged.location).toBe('following');

      // Sources should include both "collection" and "following"
      expect(merged.sources.sort()).toEqual(['collection', 'following'].sort());

      // digestMeta preserved from backfill
      expect(merged.digestMeta).toEqual({
        collectionName: 'My Collection',
        communityName: 'My Community',
      });
    });
  });

  describe('buildNotificationDigestForUser', () => {
    it('groups notifications into normal bucket with appropriate labels', async () => {
      const userId = new mongoose.Types.ObjectId();

      const userFindSpy = jest.spyOn(UserModel, 'findOne');
      // First call: for following builder
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
          email: 'alice@example.com',
          password: 'hashed',
          dateJoined: new Date(),
          followers: [],
          following: [],
        } as any),
      } as any);

      // Second call: for getOrCreatePreferences
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
        } as any),
      } as any);

      jest.spyOn(BookmarkModel, 'find').mockResolvedValue([] as any);
      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const eventDate1 = new Date('2024-01-01T10:00:00Z');
      const eventDate2 = new Date('2024-01-02T10:00:00Z');

      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            user: 'alice',
            actor: 'bob',
            message: 'bob followed you',
            eventDate: eventDate1,
            targetId: new mongoose.Types.ObjectId(),
            targetType: 'User',
            location: 'following',
            link: '/user/bob',
            category: 'follow',
          },
          {
            _id: new mongoose.Types.ObjectId(),
            user: 'alice',
            actor: 'carol',
            message: 'carol sent you a DM',
            eventDate: eventDate2,
            targetId: new mongoose.Types.ObjectId(),
            targetType: 'User',
            location: 'direct',
            link: '/messaging/direct-message',
            category: 'direct',
          },
        ]),
      } as any);

      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          user: userId,
          mutedUsers: [],
          mutedCommunities: [],
          mutedCollections: [],
          perCategoryLocation: new Map(),
          perCategory: new Map(),
          perLocation: new Map(),
          defaultPriority: 'normal',
          dndEnabled: false,
          silentHours: { start: null, end: null },
          muteHighGroups: false,
          muteNormalGroups: false,
          muteLowGroups: false,
        } as any),
      } as any);

      const result = await buildNotificationDigestForUser('alice');

      expect('error' in (result as any)).toBe(false);

      const digest = result as any;

      // All should land in "normal" bucket
      expect(digest.high).toHaveLength(0);
      expect(digest.low).toHaveLength(0);
      expect(digest.muted).toHaveLength(0);
      expect(digest.normal).toHaveLength(2);

      const labels = digest.normal.map((g: any) => g.label);

      // One label for follow events, one for direct messages
      expect(labels.join(' ')).toContain('follow event');
      expect(labels.join(' ')).toContain('direct message');

      // Newest group (carol's DM) should come first
      const firstGroup = digest.normal[0];
      const latestTimes = firstGroup.notifications.map((n: any) => n.eventDate.getTime());
      expect(Math.max(...latestTimes)).toBe(eventDate2.getTime());
    });

    it('puts muted notifications into muted bucket when preferences mute them', async () => {
      const userId = new mongoose.Types.ObjectId();

      const userFindSpy = jest.spyOn(UserModel, 'findOne');
      // First call: for following builder
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
          email: 'alice@example.com',
          password: 'hashed',
          dateJoined: new Date(),
          followers: [],
          following: [],
        } as any),
      } as any);

      // Second call: for getOrCreatePreferences
      userFindSpy.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          username: 'alice',
        } as any),
      } as any);

      jest.spyOn(BookmarkModel, 'find').mockResolvedValue([] as any);
      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const eventDate = new Date('2024-01-01T10:00:00Z');

      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            user: 'alice',
            actor: 'bob',
            message: 'bob followed you',
            eventDate,
            targetId: new mongoose.Types.ObjectId(),
            targetType: 'User',
            location: 'following',
            link: '/user/bob',
            category: 'follow',
          },
        ]),
      } as any);

      // Preferences: DND enabled so isNotificationMuted will treat everything as muted
      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          user: userId,
          mutedUsers: [],
          mutedCommunities: [],
          mutedCollections: [],
          perCategoryLocation: new Map(),
          perCategory: new Map(),
          perLocation: new Map(),
          defaultPriority: 'normal',
          dndEnabled: true,
          silentHours: { start: null, end: null },
          muteHighGroups: false,
          muteNormalGroups: false,
          muteLowGroups: false,
        } as any),
      } as any);

      const result = await buildNotificationDigestForUser('alice');

      expect('error' in (result as any)).toBe(false);

      const digest = result as any;

      expect(digest.high).toHaveLength(0);
      expect(digest.normal).toHaveLength(0);
      expect(digest.low).toHaveLength(0);
      expect(digest.muted).toHaveLength(1);

      const mutedGroup = digest.muted[0];
      expect(mutedGroup.count).toBe(1);
      expect(mutedGroup.notifications).toHaveLength(1);
      expect(mutedGroup.priority).toBe('muted');
    });
  });

  describe('digest internals – computeDigestGrouping and buildDigestLabel', () => {
    /**
     * Helper to create a minimal Notification-like object for grouping tests.
     * Only the fields used by computeDigestGrouping are provided.
     */
    // Helper to create a minimal Notification-like object for grouping tests.
    const makeNotif = (overrides: Partial<NotificationItem>) =>
      ({
        actor: 'alice',
        message: 'msg',
        eventDate: new Date('2024-01-01T00:00:00Z'),
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'Question',
        category: 'question',
        sources: ['collection'],
        digestMeta: undefined,
        ...overrides,
      }) as any;

    it('computeDigestGrouping groups backfill collection / community variants correctly', () => {
      // Collection-only backfill
      const collNotif = makeNotif({
        category: 'backfill',
        location: 'collection',
        digestMeta: { collectionName: 'MyColl', communityName: '' },
      });

      const collGroup = computeDigestGrouping(collNotif, 'high');
      expect(collGroup.key).toBe('high:backfill:collection:MyColl');
      expect(collGroup.labelContext).toBe('your bookmarked collection "MyColl"');

      // Community-only backfill
      const commNotif = makeNotif({
        category: 'backfill',
        location: 'community',
        digestMeta: { collectionName: '', communityName: 'MyComm' },
      });

      const commGroup = computeDigestGrouping(commNotif, 'normal');
      expect(commGroup.key).toBe('normal:backfill:community:MyComm');
      expect(commGroup.labelContext).toBe('your bookmarked community "MyComm"');

      // Both collection and community contributed
      const bothNotif = makeNotif({
        category: 'backfill',
        location: 'collection/community',
        digestMeta: { collectionName: 'MyColl', communityName: 'MyComm' },
      });

      const bothGroup = computeDigestGrouping(bothNotif, 'low');
      expect(bothGroup.key).toBe('low:backfill:collection-community:MyColl:MyComm');
      expect(bothGroup.labelContext).toBe(
        'your bookmarked collection "MyColl" and community "MyComm"',
      );
    });

    it('computeDigestGrouping handles direct, follow, following Q/A, and fallback cases', () => {
      // Direct messages (group by actor)
      const directNotif = makeNotif({
        category: 'direct',
        location: 'direct',
        actor: 'bob',
      });

      const directGroup = computeDigestGrouping(directNotif, 'normal');
      expect(directGroup.key).toBe('normal:direct:bob');
      expect(directGroup.labelContext).toBe('bob');

      // Follow events (group by follower)
      const followNotif = makeNotif({
        category: 'follow',
        location: 'following',
        actor: 'charlie',
      });

      const followGroup = computeDigestGrouping(followNotif, 'high');
      expect(followGroup.key).toBe('high:follow:charlie');
      expect(followGroup.labelContext).toBe('charlie');

      // Following Q/A – group per actor
      const followingQuestionNotif = makeNotif({
        category: 'question',
        location: 'following',
        actor: 'dana',
      });

      const followingQGroup = computeDigestGrouping(followingQuestionNotif, 'normal');
      expect(followingQGroup.key).toBe('normal:question:following:dana');
      expect(followingQGroup.labelContext).toBe('dana');

      // Fallback case: unknown category / location
      // Fallback case: unknown category but valid location
      const fallbackNotif = makeNotif({
        category: 'other' as any,
        location: 'collection',
        actor: 'eve',
      });

      const fallbackGroup = computeDigestGrouping(fallbackNotif, 'low');
      expect(fallbackGroup.key).toBe('low:other:collection');
      expect(fallbackGroup.labelContext).toBeUndefined();
    });

    describe('buildDigestLabel', () => {
      it('builds backfill labels with context and muted flag', () => {
        const label = buildDigestLabel(
          3,
          'backfill',
          'collection',
          'muted',
          'your bookmarked collection "MyColl"',
        );

        expect(label).toBe('3 updates in your bookmarked collection "MyColl" (muted for you)');
      });

      it('builds direct and follow labels when context (actor) is provided', () => {
        const directLabel = buildDigestLabel(2, 'direct', 'direct', 'normal', 'bob');
        expect(directLabel).toBe('2 direct messages from bob');

        const followLabel = buildDigestLabel(1, 'follow', 'following', 'normal', 'charlie');
        expect(followLabel).toBe('1 follow event from charlie');
      });

      it('builds labels for following Q/A notifications with context and muted flag', () => {
        const ansLabel = buildDigestLabel(4, 'answer', 'following', 'muted', 'dana');
        expect(ansLabel).toBe('4 answers from dana (people you follow) (muted for you)');

        const qLabel = buildDigestLabel(1, 'question', 'following', 'normal', 'dana');
        expect(qLabel).toBe('1 question from dana (people you follow)');
      });

      it('builds generic bookmark-driven labels for answers and questions', () => {
        const ansLabel = buildDigestLabel(2, 'answer', 'collection/community', 'normal');
        expect(ansLabel).toBe(
          '2 answers were posted in your bookmarked collections and communities',
        );

        const qLabel = buildDigestLabel(1, 'question', 'community', 'normal');
        expect(qLabel).toBe('1 question were posted in your bookmarked communities');
      });

      it('builds generic direct/follow labels without context and a fallback label', () => {
        const directNoContext = buildDigestLabel(2, 'direct', 'direct', 'muted');
        expect(directNoContext).toBe('2 direct messages arrived (muted for you)');

        const followNoContext = buildDigestLabel(1, 'follow', 'following', 'normal');
        expect(followNoContext).toBe('1 follow event occurred');

        // Use any valid NotificationLocation here; category 'other' forces the fallback path
        const fallback = buildDigestLabel(5, 'other' as any, 'collection', 'muted');
        expect(fallback).toBe('5 notifications (muted for you)');
      });
    });
  });
});
