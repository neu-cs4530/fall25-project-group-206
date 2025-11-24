// server/tests/services/notificationFeed.feed-core.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CommunityModel from '../../models/community.model';
import UserModel from '../../models/users.model';
import QuestionModel from '../../models/questions.model';
import NotificationModel from '../../models/notification.model';
import NotificationPreferencesModel from '../../models/notificationPreference.model';
import { populateDocument } from '../../utils/database.util';
import buildBackfillNotificationsForUser from '../../utils/backfillNotifications.util';

import { buildNotificationFeedForUser } from '../../services/notificationFeed.service';

import type {
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

const basePrefs = {
  mutedUsers: [] as string[],
  mutedCommunities: [] as string[],
  mutedCollections: [] as string[],
  perCategoryLocation: new Map<string, 'high' | 'normal' | 'low'>(),
  perCategory: new Map<string, 'high' | 'normal' | 'low'>(),
  perLocation: new Map<string, 'high' | 'normal' | 'low'>(),
  defaultPriority: 'normal' as const,
};

const populateDocumentMock = populateDocument as jest.Mock;
const buildBackfillMock = buildBackfillNotificationsForUser as jest.Mock;

/**
 * Helper to narrow NotificationItem[] | { error: string } into NotificationItem[]
 * and fail the test loudly if an error is returned.
 */
function expectNotificationFeed(value: NotificationItem[] | { error: string }): NotificationItem[] {
  if ('error' in value) {
    throw new Error(`Expected notifications array but received error: ${value.error}`);
  }
  return value;
}

describe('notificationFeed.service – full feed (core)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: preferences exist in memory → no DB writes
    jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(basePrefs),
    } as any);
  });

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
      select: jest.fn().mockReturnThis(),
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
    const feed = expectNotificationFeed(feedResult);

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
      select: jest.fn().mockReturnThis(),
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

    // No "follow-you" docs for this scenario
    jest.spyOn(NotificationModel, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([] as any),
    } as any);

    const feedResult = await buildNotificationFeedForUser('alice');
    const feed = expectNotificationFeed(feedResult);

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
      select: jest.fn().mockReturnThis(),
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
      link: '/messaging/direct-message',
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
      link: '/messaging/direct-message',
      category: 'direct',
      isRead: false,
    } as any;

    jest.spyOn(NotificationModel, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([directDoc1, directDoc2]),
    } as any);

    const feedResult = await buildNotificationFeedForUser('alice');
    const feed = expectNotificationFeed(feedResult);

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
      select: jest.fn().mockReturnThis(),
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
    const feed = expectNotificationFeed(feedResult);

    // We expect two notifications (question + answer), but both from "following"
    expect(feed).toHaveLength(2);

    const questionNotif = feed.find(n => n.targetType === 'Question');
    const answerNotif = feed.find(n => n.targetType === 'Answer');

    expect(questionNotif).toBeDefined();
    expect(questionNotif?.location).toBe('following');
    expect(questionNotif?.actor).toBe('bob');
    expect(questionNotif?.message).toBe('Someone you follow, bob, posted a question "Overlap Q".');

    expect(answerNotif).toBeDefined();
    expect(answerNotif?.location).toBe('following');
    expect(answerNotif?.actor).toBe('bob');
    expect(answerNotif?.message).toBe('Someone you follow, bob, posted an answer to "Overlap Q".');
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
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('following-crash')),
    } as any);

    const result = await buildNotificationFeedForUser('alice');

    expect(result).toEqual({ error: 'following-crash' });
  });
});
