// server/tests/notificationFeed.service.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CommunityModel from '../../models/community.model';
import UserModel from '../../models/users.model';
import QuestionModel from '../../models/questions.model';
import NotificationModel from '../../models/notification.model';
import { populateDocument } from '../../utils/database.util';
import buildBackfillNotificationsForUser from '../../utils/backfillNotifications.util';

import {
  buildNotificationsFromBookmarks,
  buildNotificationsFromFollowing,
  buildNotificationFeedForUser,
} from '../../services/notificationFeed.service';

import type {
  DatabaseCommunity,
  PopulatedDatabaseCollection,
  PopulatedDatabaseQuestion,
  PopulatedDatabaseAnswer,
  NotificationItem,
  DatabaseNotification,
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

/**
 * Helper to narrow NotificationItem[] | { error: string } into NotificationItem[]
 * and fail the test loudly if an error is returned.
 */
function expectNotifications(value: NotificationItem[] | { error: string }): NotificationItem[] {
  if ('error' in value) {
    fail(`Unexpected error: ${value.error}`);
  }
  return value;
}

describe('notificationFeed.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      // CommunityModel.find should be called with the community id
      expect(CommunityModel.find).toHaveBeenCalledTimes(1);
      expect(buildBackfillMock).toHaveBeenCalledWith([hydratedCollection], [hydratedCommunity]);

      // Service may add extra fields (e.g., `sources`), so do a partial match
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject(fakeNotifications[0]);
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
    });

    it('returns { error } when an exception is thrown', async () => {
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('crash')),
      } as any);

      const result = await buildNotificationsFromFollowing('alice');

      expect(result).toEqual({ error: 'crash' });
    });
  });

  describe('buildNotificationFeedForUser', () => {
    it('merges bookmarks, following, and follow events with precedence', async () => {
      // 1) Stub bookmarks → one notification for Q1 via collection
      const qId = new mongoose.Types.ObjectId();
      const baseDate = new Date('2024-01-01T00:00:00Z');

      const fromBookmarks: NotificationItem[] = [
        {
          actor: 'bob',
          message: 'bob via bookmarks',
          eventDate: baseDate,
          targetId: qId,
          targetType: 'Question',
          location: 'collection',
          category: 'question',
          link: `/question/${qId.toString()}`,
        },
      ];

      // Mock BookmarkModel / populateDocument / CommunityModel / backfill → fromBookmarks
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([
        {
          username: 'alice',
          targetId: new mongoose.Types.ObjectId(),
          targetType: 'Collection',
        },
      ] as any);
      populateDocumentMock.mockResolvedValueOnce({} as any);
      jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);
      buildBackfillMock.mockResolvedValueOnce(fromBookmarks);

      // Mock UserModel + QuestionModel → fromFollowing
      const fakeUser: DatabaseUser & { following: DatabaseUser[] } = {
        _id: new mongoose.Types.ObjectId(),
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [
          {
            _id: new mongoose.Types.ObjectId(),
            username: 'bob',
          } as any,
        ],
      } as any;

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUser),
      } as any);

      const question: PopulatedDatabaseQuestion = {
        _id: qId,
        title: 'Q1',
        text: 'body',
        askedBy: 'bob',
        askDateTime: baseDate,
        answers: [],
        tags: [],
        comments: [],
        views: [],
        upVotes: [],
        downVotes: [],
        community: null,
      } as any;

      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([question]),
      } as any);

      // Mock NotificationModel.find → follow events
      const followDoc: DatabaseNotification = {
        _id: new mongoose.Types.ObjectId(),
        user: 'alice',
        actor: 'charlie',
        message: 'charlie started following you',
        eventDate: new Date('2024-01-03T00:00:00Z'),
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'User',
        location: 'following',
        link: '/user/charlie',
        category: 'follow',
        isRead: false,
      } as any;

      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([followDoc]),
      } as any);

      const feedResult = await buildNotificationFeedForUser('alice');

      // Narrow or fail explicitly if error branch appears
      if ('error' in feedResult) {
        fail(`Expected notifications array but received error: ${feedResult.error}`);
      }

      const feed = feedResult as NotificationItem[];

      expect(feed.length).toBe(2);

      const [first, second] = feed;

      // Newest by date: follow event
      expect(first.category).toBe('follow');
      expect(first.actor).toBe('charlie');
      expect(first.message).toContain('started following you');

      // For Q1, the "following" notification should override the bookmarks one
      expect(second.location).toBe('following');
      expect(second.message).toBe('Someone you follow, bob, posted a question "Q1".');
    });

    it('includes following-based notifications when there are no bookmark-based notifications', async () => {
      // No bookmarks → buildNotificationsFromBookmarks returns []
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([] as any);
      buildBackfillMock.mockResolvedValueOnce([] as any);
      jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);

      // User follows bob
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
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUser),
      } as any);

      const qId = new mongoose.Types.ObjectId();
      const questionDate = new Date('2024-01-01T10:00:00Z');
      const answerDate = new Date('2024-01-02T10:00:00Z');

      const question: PopulatedDatabaseQuestion = {
        _id: qId,
        title: 'Standalone Q',
        text: 'body',
        askedBy: 'bob',
        askDateTime: questionDate,
        answers: [],
        tags: [],
        comments: [],
        views: [],
        upVotes: [],
        downVotes: [],
        community: null, // explicitly no community
      } as any;

      const answer: PopulatedDatabaseAnswer = {
        _id: new mongoose.Types.ObjectId(),
        text: 'answer body',
        ansBy: 'bob',
        ansDateTime: answerDate,
        comments: [],
      } as any;

      (question as any).answers = [answer];

      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([question]),
      } as any);

      // No "follow-you" docs for this scenario
      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([] as any),
      } as any);

      const feedResult = await buildNotificationFeedForUser('alice');
      if ('error' in feedResult) {
        fail(`Expected notifications array but received error: ${feedResult.error}`);
      }

      const feed = feedResult as NotificationItem[];

      // Expect two items in the feed: one Answer, one Question (newest → oldest)
      expect(feed).toHaveLength(2);

      const answerNotif = feed.find(n => n.targetType === 'Answer');
      const questionNotif = feed.find(n => n.targetType === 'Question');

      expect(answerNotif).toBeDefined();
      expect(answerNotif?.location).toBe('following');
      expect(answerNotif?.actor).toBe('bob');
      expect(answerNotif?.message).toBe(
        'Someone you follow, bob, posted an answer to "Standalone Q".',
      );

      expect(questionNotif).toBeDefined();
      expect(questionNotif?.location).toBe('following');
      expect(questionNotif?.actor).toBe('bob');
      expect(questionNotif?.message).toBe(
        'Someone you follow, bob, posted a question "Standalone Q".',
      );
    });

    it('includes "direct" category notifications from NotificationModel in the feed', async () => {
      // 1) No bookmarks → bookmarks branch returns []
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([] as any);
      buildBackfillMock.mockResolvedValueOnce([] as any);
      jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);

      // 2) No following → following branch returns []
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
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUser),
      } as any);

      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([] as any),
      } as any);

      // 3) Direct message notifications from NotificationModel
      const olderDate = new Date('2024-03-01T10:00:00Z');
      const newerDate = new Date('2024-03-02T10:00:00Z');

      const directDoc1: DatabaseNotification = {
        _id: new mongoose.Types.ObjectId(),
        user: 'alice',
        actor: 'bob',
        message: 'bob sent you a message: "hey"',
        eventDate: olderDate,
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'User',
        location: 'direct',
        link: '/messaging',
        category: 'direct',
        isRead: false,
      } as any;

      const directDoc2: DatabaseNotification = {
        _id: new mongoose.Types.ObjectId(),
        user: 'alice',
        actor: 'carol',
        message: 'carol sent you a message: "yo"',
        eventDate: newerDate,
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'User',
        location: 'direct',
        link: '/messaging',
        category: 'direct',
        isRead: false,
      } as any;

      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([directDoc1, directDoc2]),
      } as any);

      const feedResult = await buildNotificationFeedForUser('alice');

      if ('error' in feedResult) {
        fail(`Expected notifications array but received error: ${feedResult.error}`);
      }

      const feed = feedResult as NotificationItem[];

      // Should get both direct notifications, newest → oldest
      expect(feed).toHaveLength(2);
      expect(feed[0].category).toBe('direct');
      expect(feed[0].actor).toBe('carol');
      expect(feed[0].message).toBe('carol sent you a message: "yo"');
      expect(feed[1].category).toBe('direct');
      expect(feed[1].actor).toBe('bob');
      expect(feed[1].message).toBe('bob sent you a message: "hey"');
    });

    it('prefers following-based notifications over bookmark-based ones for the same question and answer', async () => {
      const qId = new mongoose.Types.ObjectId();
      const questionDate = new Date('2024-02-01T10:00:00Z');
      const answerDate = new Date('2024-02-02T10:00:00Z');

      // Bookmark-based notifications (e.g., via collection/community backfill)
      const bookmarkQuestionNotif: NotificationItem = {
        actor: 'bob',
        message: 'bob via bookmarks (question)',
        eventDate: questionDate,
        targetId: qId,
        targetType: 'Question',
        location: 'collection',
        category: 'question',
        link: `/question/${qId.toString()}`,
      };

      const bookmarkAnswerNotif: NotificationItem = {
        actor: 'bob',
        message: 'bob via bookmarks (answer)',
        eventDate: answerDate,
        targetId: qId,
        targetType: 'Answer',
        location: 'collection',
        category: 'answer',
        link: `/question/${qId.toString()}`,
      };

      const fromBookmarks: NotificationItem[] = [bookmarkQuestionNotif, bookmarkAnswerNotif];

      // Mock BookmarkModel / populateDocument / CommunityModel / backfill → fromBookmarks
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([
        {
          username: 'alice',
          targetId: new mongoose.Types.ObjectId(),
          targetType: 'Collection',
        },
      ] as any);
      populateDocumentMock.mockResolvedValueOnce({} as any);
      jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);
      buildBackfillMock.mockResolvedValueOnce(fromBookmarks);

      // Following-based source: alice follows bob
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
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(fakeUser),
      } as any);

      const question: PopulatedDatabaseQuestion = {
        _id: qId,
        title: 'Overlap Q',
        text: 'body',
        askedBy: 'bob',
        askDateTime: questionDate,
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
        ansDateTime: answerDate,
        comments: [],
      } as any;

      (question as any).answers = [answer];

      jest.spyOn(QuestionModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([question]),
      } as any);

      // No follow-you docs for this scenario
      jest.spyOn(NotificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([] as any),
      } as any);

      const feedResult = await buildNotificationFeedForUser('alice');
      if ('error' in feedResult) {
        fail(`Expected notifications array but received error: ${feedResult.error}`);
      }

      const feed = feedResult as NotificationItem[];

      // We expect two notifications (question + answer), but both from "following"
      expect(feed).toHaveLength(2);

      const questionNotif = feed.find(n => n.targetType === 'Question');
      const answerNotif = feed.find(n => n.targetType === 'Answer');

      expect(questionNotif).toBeDefined();
      expect(questionNotif?.location).toBe('following');
      expect(questionNotif?.actor).toBe('bob');
      expect(questionNotif?.message).toBe(
        'Someone you follow, bob, posted a question "Overlap Q".',
      );

      expect(answerNotif).toBeDefined();
      expect(answerNotif?.location).toBe('following');
      expect(answerNotif?.actor).toBe('bob');
      expect(answerNotif?.message).toBe(
        'Someone you follow, bob, posted an answer to "Overlap Q".',
      );
    });

    it('returns { error } when bookmark builder returns error', async () => {
      // Force buildNotificationsFromBookmarks path to error via BookmarkModel
      jest.spyOn(BookmarkModel, 'find').mockRejectedValueOnce(new Error('bookmark-crash'));

      const result = await buildNotificationFeedForUser('alice');

      expect(result).toEqual({ error: 'bookmark-crash' });
    });

    it('returns { error } when following builder returns error', async () => {
      // bookmarks ok but following throws
      jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([] as any);

      // Make UserModel.findOne path throw
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('following-crash')),
      } as any);

      const result = await buildNotificationFeedForUser('alice');

      expect(result).toEqual({ error: 'following-crash' });
    });
  });
});
