// server/tests/notificationFanout.service.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import CollectionModel from '../../models/collection.model';
import NotificationModel from '../../models/notification.model';
import UserModel from '../../models/users.model';

import {
  notifyOnNewQuestion,
  notifyOnNewAnswer,
  notifyOnDirectMessage,
} from '../../services/notificationFanout.service';
import type {
  PopulatedDatabaseQuestion,
  PopulatedDatabaseAnswer,
  DatabaseCommunity,
  DatabaseMessage,
  DatabaseChat,
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

    // Default: no followers for any actor, to avoid real DB
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    } as any);

    jest.spyOn(UserModel, 'find').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    } as any);
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
    } as any;

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
    } as any;

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

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewQuestion(question);

    expect(insertManySpy).toHaveBeenCalledTimes(1);
    const payloadArg = insertManySpy.mock.calls[0][0] as any[];

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
    const collectionId = new mongoose.Types.ObjectId();

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
    } as any;

    const answer: PopulatedDatabaseAnswer = {
      _id: new mongoose.Types.ObjectId(),
      text: 'Answer body',
      ansBy: 'charlie',
      ansDateTime: new Date('2024-01-03T00:00:00Z'),
      comments: [],
    } as any;

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

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewAnswer(question, answer);

    expect(insertManySpy).toHaveBeenCalledTimes(1);
    const payloadArg = insertManySpy.mock.calls[0][0] as any[];

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

test('notifyOnDirectMessage is a no-op for non-direct messages', async () => {
  const message: DatabaseMessage = {
    _id: new mongoose.Types.ObjectId(),
    msg: 'Hello from global',
    msgFrom: 'alice',
    msgDateTime: new Date('2024-01-05T10:00:00Z'),
    type: 'global', // not "direct"
  } as any;

  const chat: DatabaseChat = {
    _id: new mongoose.Types.ObjectId(),
    participants: ['alice', 'bob'],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
  const emitSpy = emitNotification as jest.Mock;

  await notifyOnDirectMessage(message, chat);

  expect(insertManySpy).not.toHaveBeenCalled();
  expect(emitSpy).not.toHaveBeenCalled();
});

test('notifyOnDirectMessage fan-outs to all other participants and pings them', async () => {
  const msgDate = new Date('2024-01-06T12:00:00Z');

  const message: DatabaseMessage = {
    _id: new mongoose.Types.ObjectId(),
    msg: 'Hey team, quick sync?',
    msgFrom: 'alice',
    msgDateTime: msgDate,
    type: 'direct',
  } as any;

  const chat: DatabaseChat = {
    _id: new mongoose.Types.ObjectId(),
    participants: ['alice', 'bob', 'carol'],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
  const emitSpy = emitNotification as jest.Mock;

  await notifyOnDirectMessage(message, chat);

  expect(insertManySpy).toHaveBeenCalledTimes(1);
  const docs = insertManySpy.mock.calls[0][0] as any[];

  // Should notify bob and carol, not alice
  expect(docs).toHaveLength(2);
  const users = docs.map(d => d.user).sort();
  expect(users).toEqual(['bob', 'carol']);

  for (const d of docs) {
    expect(d.actor).toBe('alice');
    expect(d.message).toBe('alice sent you a message: "Hey team, quick sync?"');
    expect(d.eventDate.getTime()).toBe(msgDate.getTime());
    expect(d.targetId.toString()).toBe(message._id.toString());
    expect(d.targetType).toBe('User');
    expect(d.location).toBe('direct');
    expect(d.link).toBe('/messaging');
    expect(d.category).toBe('direct');
    expect(d.isRead).toBe(false);
  }

  // emitNotification should have been called once per recipient
  expect(emitSpy).toHaveBeenCalledTimes(2);
  expect(emitSpy).toHaveBeenCalledWith('bob');
  expect(emitSpy).toHaveBeenCalledWith('carol');
});
