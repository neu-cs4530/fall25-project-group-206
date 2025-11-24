// server/tests/services/notificationFeed.feed-filters-and-priority.spec.ts
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
  PopulatedDatabaseCollection,
  NotificationItem,
  DatabaseNotification,
  DatabaseUser,
} from '../../types/types';
// server/tests/services/notificationFeed.feed-filters-and-priority.spec.ts
import * as notificationPrefsService from '../../services/notificationPreferences.service';
import * as notificationFeedService from '../../services/notificationFeed.service';

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

describe('notificationFeed.service – filters and priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(basePrefs),
    } as any);
  });

  it('filters out notifications from muted users (friends)', async () => {
    // No bookmark or following-based notifications
    jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([] as any);
    buildBackfillMock.mockResolvedValueOnce([] as any);
    jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);

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

    // Two direct notifications, both from "bob"
    const directDoc1: DatabaseNotification = {
      _id: new mongoose.Types.ObjectId(),
      user: 'alice',
      actor: 'bob',
      message: 'bob sent you a message: "hey"',
      eventDate: new Date('2024-04-01T10:00:00Z'),
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
      actor: 'bob',
      message: 'bob sent you another message: "yo"',
      eventDate: new Date('2024-04-01T11:00:00Z'),
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

    // Preferences: "bob" is muted, everything else default
    const prefsDoc = {
      mutedUsers: ['bob'],
      mutedCommunities: [] as string[],
      mutedCollections: [] as string[],
      perCategoryLocation: new Map(),
      perCategory: new Map(),
      perLocation: new Map(),
      defaultPriority: 'normal' as const,
    };

    (NotificationPreferencesModel.findOne as unknown as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(prefsDoc),
    } as any);

    const feedResult = await buildNotificationFeedForUser('alice');
    const feed = expectNotificationFeed(feedResult);

    // All notifications from "bob" should be filtered out.
    expect(feed).toHaveLength(0);
  });

  it('filters out notifications originating from muted collections', async () => {
    const collId = new mongoose.Types.ObjectId();
    const collIdStr = collId.toString();

    // One collection bookmark
    jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([
      {
        username: 'alice',
        targetId: collId,
        targetType: 'Collection',
      },
    ] as any);

    const hydratedCollection: PopulatedDatabaseCollection = {
      _id: collId,
      name: 'Muted Collection',
      description: 'desc',
      questions: [],
      username: 'alice',
      isPrivate: false,
    } as any;

    populateDocumentMock.mockResolvedValueOnce(hydratedCollection);
    jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);

    // Backfill would normally produce a notification for this collection
    const backfillNotifs: NotificationItem[] = [
      {
        actor: 'bob',
        message: 'bob posted in muted collection',
        eventDate: new Date('2024-04-02T10:00:00Z'),
        targetId: new mongoose.Types.ObjectId(),
        targetType: 'Question',
        location: 'collection',
        category: 'question',
        link: '/question/123',
      },
    ];
    buildBackfillMock.mockResolvedValueOnce(backfillNotifs);

    // No following-based notifications or direct/follow events
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

    jest.spyOn(NotificationModel, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([] as any),
    } as any);

    // Preferences: the collection is muted
    const prefsDoc = {
      mutedUsers: [] as string[],
      mutedCommunities: [] as string[],
      mutedCollections: [collIdStr],
      perCategoryLocation: new Map(),
      perCategory: new Map(),
      perLocation: new Map(),
      defaultPriority: 'normal' as const,
    };

    (NotificationPreferencesModel.findOne as unknown as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(prefsDoc),
    } as any);

    const feedResult = await buildNotificationFeedForUser('alice');
    const feed = expectNotificationFeed(feedResult);

    // All notifications produced from that collection should be filtered out.
    expect(feed).toHaveLength(0);

    // Ensure backfill was still called with the hydrated collection
    expect(buildBackfillMock).toHaveBeenCalled();
  });

  it('filters out notifications originating from muted communities', async () => {
    // Construct a single notification representing activity in a community
    const commNotif: NotificationItem = {
      actor: 'bob',
      message: 'bob posted in muted community',
      eventDate: new Date('2024-04-03T10:00:00Z'),
      targetId: new mongoose.Types.ObjectId(),
      targetType: 'Question',
      location: 'community',
      category: 'question',
      link: '/question/456',
      sources: ['community'],
    };

    // 1) Force the bookmarks builder to return just this community notification
    jest
      .spyOn(notificationFeedService, 'buildNotificationsFromBookmarks')
      .mockResolvedValueOnce([commNotif]);

    // 2) No following-based notifications
    jest
      .spyOn(notificationFeedService, 'buildNotificationsFromFollowing')
      .mockResolvedValueOnce([]);

    // 3) No "follow" or "direct" docs from Notification collection
    jest.spyOn(NotificationModel, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([] as any),
    } as any);

    // 4) Preferences: pretend there is a muted community (exact id does not matter here)
    const prefsDoc = {
      mutedUsers: [] as string[],
      mutedCommunities: ['muted-community-id'],
      mutedCollections: [] as string[],
      perCategoryLocation: new Map(),
      perCategory: new Map(),
      perLocation: new Map(),
      defaultPriority: 'normal' as const,
    };

    // Make getOrCreatePreferences return this prefs document
    jest
      .spyOn(notificationPrefsService, 'getOrCreatePreferences')
      .mockResolvedValueOnce(prefsDoc as any);

    // 5) Critical: override isNotificationMuted so that ANY community notification is treated as muted
    jest
      .spyOn(notificationPrefsService, 'isNotificationMuted')
      .mockImplementation(async (notif: NotificationItem) => {
        return notif.location === 'community';
      });

    // We can keep the real priority resolver, but to be explicit:
    jest
      .spyOn(notificationPrefsService, 'resolvePriorityForNotification')
      .mockImplementation((notif: NotificationItem) => {
        return 'normal';
      });

    const feedResult = await buildNotificationFeedForUser('alice');
    const feed = expectNotificationFeed(feedResult);

    // All notifications from the community should be filtered out.
    expect(feed).toHaveLength(0);
  });

  it('applies notification priorities and sorts by priority (high → normal → low) then date', async () => {
    // No bookmarks / following
    jest.spyOn(BookmarkModel, 'find').mockResolvedValueOnce([] as any);
    buildBackfillMock.mockResolvedValueOnce([] as any);
    jest.spyOn(CommunityModel, 'find').mockResolvedValueOnce([] as any);

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

    // Three NotificationModel docs with different categories/locations
    const baseDate = new Date('2024-05-01T10:00:00Z');

    const lowDoc: DatabaseNotification = {
      _id: new mongoose.Types.ObjectId(),
      user: 'alice',
      actor: 'lowUser',
      message: 'low priority event',
      eventDate: new Date(baseDate.getTime()),
      targetId: new mongoose.Types.ObjectId(),
      targetType: 'User',
      location: 'direct',
      link: '/low',
      category: 'direct',
      isRead: false,
    } as any;

    const normalDoc: DatabaseNotification = {
      _id: new mongoose.Types.ObjectId(),
      user: 'alice',
      actor: 'normalUser',
      message: 'normal priority event',
      eventDate: new Date(baseDate.getTime() + 1000),
      targetId: new mongoose.Types.ObjectId(),
      targetType: 'User',
      location: 'following',
      link: '/normal',
      category: 'follow',
      isRead: false,
    } as any;

    const highDoc: DatabaseNotification = {
      _id: new mongoose.Types.ObjectId(),
      user: 'alice',
      actor: 'highUser',
      message: 'high priority event',
      eventDate: new Date(baseDate.getTime() + 2000),
      targetId: new mongoose.Types.ObjectId(),
      targetType: 'User',
      location: 'following',
      link: '/high',
      category: 'question',
      isRead: false,
    } as any;

    jest.spyOn(NotificationModel, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([lowDoc, normalDoc, highDoc]),
    } as any);

    // Instead of relying on the full real preferences logic, stub the helpers
    // so we have complete control over priority assignment.

    // getOrCreatePreferences can just return any object; it will be passed through
    jest.spyOn(notificationPrefsService, 'getOrCreatePreferences').mockResolvedValueOnce({
      mutedUsers: [],
      mutedCommunities: [],
      mutedCollections: [],
      perCategoryLocation: new Map(),
      perCategory: new Map(),
      perLocation: new Map(),
      defaultPriority: 'low',
    } as any);

    // No notifications are muted in this test
    jest
      .spyOn(notificationPrefsService, 'isNotificationMuted')
      .mockImplementation(async () => false);

    // Explicitly control the priority mapping by actor
    jest
      .spyOn(notificationPrefsService, 'resolvePriorityForNotification')
      .mockImplementation((notif: NotificationItem) => {
        switch (notif.actor) {
          case 'highUser':
            return 'high';
          case 'normalUser':
            return 'normal';
          case 'lowUser':
          default:
            return 'low';
        }
      });

    const feedResult = await buildNotificationFeedForUser('alice');
    const feed = expectNotificationFeed(feedResult);

    expect(feed).toHaveLength(3);

    const [first, second, third] = feed;

    // Because eventDate is newest → oldest (high > normal > low),
    // and we annotate priorities via our stub, we should see:
    expect(first.priority).toBe('high');
    expect(first.actor).toBe('highUser');

    expect(second.priority).toBe('normal');
    expect(second.actor).toBe('normalUser');

    expect(third.priority).toBe('low');
    expect(third.actor).toBe('lowUser');
  });
});
