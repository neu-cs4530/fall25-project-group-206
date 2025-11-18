// server/tests/notificationFanout.service.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CollectionModel from '../../models/collection.model';
import NotificationModel from '../../models/notification.model';
import { notifyOnNewQuestion, notifyOnNewAnswer } from '../../services/notificationFanout.service';
import type {
  PopulatedDatabaseQuestion,
  PopulatedDatabaseAnswer,
  DatabaseCommunity,
} from '../../types/types';

// Mock emitNotification so we do not rely on real sockets
jest.mock('../../utils/realtime', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import emitNotification from '../../utils/realtime';

describe('notificationFanout.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notifyOnNewQuestion notifies users who bookmarked the community', async () => {
    const communityId = new mongoose.Types.ObjectId();

    const community: DatabaseCommunity = {
      _id: communityId,
      name: 'Test Community',
      description: 'desc',
      visibility: 'PUBLIC',
      participants: [],
      admin: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const question: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Community question',
      text: 'Question body',
      askedBy: 'alice',
      askDateTime: new Date('2024-01-02T03:00:00Z'),
      answers: [],
      tags: [],
      comments: [],
      views: [],
      upVotes: [],
      downVotes: [],
      community,
    };

    // 1) No collections contain this question
    jest.spyOn(CollectionModel, 'find').mockImplementation(() => {
      return {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // no collections
      } as any;
    });

    // 2) One user bookmarked this community
    const bookmarkFindSpy = jest.spyOn(BookmarkModel, 'find') as any;

    bookmarkFindSpy.mockImplementation((query: any) => {
      let result: any[] = [];

      if (query.targetType === 'Community') {
        result = [
          {
            username: 'bob',
            targetId: communityId,
            targetType: 'Community',
          },
        ];
      }

      // For any other query, return []
      return {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(result),
      } as any;
    });

    const createSpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewQuestion(question);

    expect(createSpy).toHaveBeenCalledTimes(1);
    const payloadArg = createSpy.mock.calls[0][0] as any[];

    expect(payloadArg).toHaveLength(1);
    expect(payloadArg[0].user).toBe('bob');
    expect(payloadArg[0].actor).toBe('alice');
    expect(payloadArg[0].targetType).toBe('Question');
    expect(payloadArg[0].location).toBe('community');
    expect(payloadArg[0].message).toContain('posted a question');
    expect(payloadArg[0].message).toContain('Community question');

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('bob');
  });

  test('notifyOnNewAnswer notifies users who bookmarked a collection containing the question', async () => {
    const questionId = new mongoose.Types.ObjectId();

    const question: PopulatedDatabaseQuestion = {
      _id: questionId,
      title: 'Collection question',
      text: 'Question body',
      askedBy: 'alice',
      askDateTime: new Date('2024-01-02T03:00:00Z'),
      answers: [],
      tags: [],
      comments: [],
      views: [],
      upVotes: [],
      downVotes: [],
      community: null,
    };

    const answer: PopulatedDatabaseAnswer = {
      _id: new mongoose.Types.ObjectId(),
      text: 'Answer body',
      ansBy: 'charlie',
      ansDateTime: new Date('2024-01-03T00:00:00Z'),
      comments: [],
    };

    const collectionId = new mongoose.Types.ObjectId();

    // 1) This question is part of one collection
    jest.spyOn(CollectionModel, 'find').mockImplementation(() => {
      return {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: collectionId,
            questions: [questionId],
          },
        ]),
      } as any;
    });

    // 2) Bookmark on that collection
    const bookmarkFindSpy = jest.spyOn(BookmarkModel, 'find') as any;

    bookmarkFindSpy.mockImplementation((query: any) => {
      let result: any[] = [];

      if (query.targetType === 'Collection') {
        result = [
          {
            username: 'dave',
            targetId: collectionId,
            targetType: 'Collection',
          },
        ];
      }

      // For any other query, return []
      return {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(result),
      } as any;
    });

    const createSpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewAnswer(question, answer);

    expect(createSpy).toHaveBeenCalledTimes(1);
    const payloadArg = createSpy.mock.calls[0][0] as any[];

    expect(payloadArg).toHaveLength(1);
    expect(payloadArg[0].user).toBe('dave');
    expect(payloadArg[0].actor).toBe('charlie');
    expect(payloadArg[0].targetType).toBe('Answer');
    expect(payloadArg[0].location).toBe('collection');
    expect(payloadArg[0].message).toContain('posted an answer');
    expect(payloadArg[0].message).toContain('Collection question');

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('dave');
  });
});
