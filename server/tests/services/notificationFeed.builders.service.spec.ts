// server/tests/services/notificationFeed.builders.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CommunityModel from '../../models/community.model';
import UserModel from '../../models/users.model';
import QuestionModel from '../../models/questions.model';
import { populateDocument } from '../../utils/database.util';
import buildBackfillNotificationsForUser from '../../utils/backfillNotifications.util';

import {
  buildNotificationsFromBookmarks,
  buildNotificationsFromFollowing,
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
});
