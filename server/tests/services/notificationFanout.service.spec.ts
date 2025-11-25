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
  DatabaseUser,
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
    jest.restoreAllMocks();

    // Default: no followers for any actor
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

    jest.spyOn(CollectionModel, 'find').mockImplementation(() => {
      return {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any;
    });

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

  test('notifyOnNewQuestion pings followers even when there are no bookmarks', async () => {
    const question: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Follower question',
      text: 'Body',
      askedBy: 'alice',
      askDateTime: new Date('2024-01-10T00:00:00Z'),
      answers: [],
      tags: [],
      comments: [],
      views: [],
      upVotes: [],
      downVotes: [],
      community: null,
    } as any;

    jest.spyOn(CollectionModel, 'find').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    // No bookmarks on collections / communities
    jest.spyOn(BookmarkModel, 'find').mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    const actorId = new mongoose.Types.ObjectId();

    // Override the default spies from beforeEach for this test
    (UserModel.findOne as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: actorId } as DatabaseUser),
    });

    (UserModel.find as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue([{ username: 'f1' }, { username: 'f2' }] as Pick<
          DatabaseUser,
          'username'
        >[]),
    });

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewQuestion(question);

    expect(insertManySpy).not.toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledWith('f1');
    expect(emitSpy).toHaveBeenCalledWith('f2');
  });

  test('notifyOnNewQuestion pings followers even when there are no bookmarks', async () => {
    const question: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Follower question',
      text: 'Body',
      askedBy: 'alice',
      askDateTime: new Date('2024-01-10T00:00:00Z'),
      answers: [],
      tags: [],
      comments: [],
      views: [],
      upVotes: [],
      downVotes: [],
      community: null,
    } as any;

    // No collections
    jest.spyOn(CollectionModel, 'find').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    // No bookmarks
    jest.spyOn(BookmarkModel, 'find').mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    // Followers exist
    const actorId = new mongoose.Types.ObjectId();
    (UserModel.findOne as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: actorId } as DatabaseUser),
    });

    (UserModel.find as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue([{ username: 'f1' }, { username: 'f2' }] as Pick<
          DatabaseUser,
          'username'
        >[]),
    });

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewQuestion(question);

    // No bookmark-based docs, since no bookmarks
    expect(insertManySpy).not.toHaveBeenCalled();

    // But followers still get real-time pings
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledWith('f1');
    expect(emitSpy).toHaveBeenCalledWith('f2');
  });

  test('notifyOnNewQuestion uses "your collection and community" when community name is empty', async () => {
    const questionId = new mongoose.Types.ObjectId();
    const collectionId = new mongoose.Types.ObjectId();
    const communityId = new mongoose.Types.ObjectId();

    const community: DatabaseCommunity = {
      _id: communityId,
      name: '   ', // blank -> forces generic phrase
      description: 'desc',
      visibility: 'PUBLIC',
      participants: [],
      admin: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const question: PopulatedDatabaseQuestion = {
      _id: questionId,
      title: 'Combined question',
      text: 'Body',
      askedBy: 'alice',
      askDateTime: new Date('2024-02-01T00:00:00Z'),
      answers: [],
      tags: [],
      comments: [],
      views: [],
      upVotes: [],
      downVotes: [],
      community,
    } as any;

    // Question is in one collection
    jest.spyOn(CollectionModel, 'find').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: collectionId,
          questions: [questionId],
        },
      ]),
    } as any);

    // Same user bookmarks both the collection and community
    const bookmarkFindSpy = jest.spyOn(BookmarkModel, 'find') as any;
    bookmarkFindSpy.mockImplementation((query: any) => {
      let result: any[] = [];

      if (query.targetType === 'Collection') {
        result = [
          {
            username: 'sam',
            targetId: collectionId,
            targetType: 'Collection',
          },
        ];
      } else if (query.targetType === 'Community') {
        result = [
          {
            username: 'sam',
            targetId: communityId,
            targetType: 'Community',
          },
        ];
      }

      return {
        exec: jest.fn().mockResolvedValue(result),
      } as any;
    });

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewQuestion(question);

    expect(insertManySpy).toHaveBeenCalledTimes(1);
    const docs = insertManySpy.mock.calls[0][0] as any[];

    expect(docs).toHaveLength(1);
    expect(docs[0].user).toBe('sam');
    expect(docs[0].location).toBe('collection/community');
    expect(docs[0].message).toContain('your collection and community');

    // Real-time ping as well
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('sam');
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

  test('notifyOnNewAnswer returns early when there are no bookmark recipients and no followers', async () => {
    const question: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Orphan question',
      text: 'Body',
      askedBy: 'alice',
      askDateTime: new Date('2024-03-01T00:00:00Z'),
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
      text: 'Orphan answer',
      ansBy: 'charlie',
      ansDateTime: new Date('2024-03-02T00:00:00Z'),
      comments: [],
    } as any;

    // No collections
    jest.spyOn(CollectionModel, 'find').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    // No bookmarks
    jest.spyOn(BookmarkModel, 'find').mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    // No followers of the answer author
    (UserModel.findOne as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });
    (UserModel.find as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnNewAnswer(question, answer);

    expect(insertManySpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// notifyOnDirectMessage tests
// ─────────────────────────────────────────────

describe('notifyOnDirectMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      expect(d.link).toBe('/messaging/direct-message');
      expect(d.category).toBe('direct');
      expect(d.isRead).toBe(false);
    }

    // emitNotification should have been called once per recipient
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledWith('bob');
    expect(emitSpy).toHaveBeenCalledWith('carol');
  });

  test('notifyOnDirectMessage with direct empty text and no other participants is a no-op', async () => {
    const message: DatabaseMessage = {
      _id: new mongoose.Types.ObjectId(),
      msg: '',
      msgFrom: 'alice',
      // msgDateTime intentionally undefined → exercises default eventDate
      type: 'direct',
    } as any;

    const chat: DatabaseChat = {
      _id: new mongoose.Types.ObjectId(),
      participants: ['alice'], // only sender; no recipients
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const insertManySpy = jest.spyOn(NotificationModel, 'insertMany').mockResolvedValue([] as any);
    const emitSpy = emitNotification as jest.Mock;

    await notifyOnDirectMessage(message, chat);

    // No docs and no pings when there are no recipients
    expect(insertManySpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  test('notifyOnDirectMessage truncates long messages to a snippet', async () => {
    const longText = 'x'.repeat(200); // > 140 characters
    const msgDate = new Date('2024-01-07T10:00:00Z');

    const message: DatabaseMessage = {
      _id: new mongoose.Types.ObjectId(),
      msg: longText,
      msgFrom: 'alice',
      msgDateTime: msgDate,
      type: 'direct',
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

    expect(insertManySpy).toHaveBeenCalledTimes(1);
    const docs = insertManySpy.mock.calls[0][0] as any[];

    expect(docs).toHaveLength(1);
    const doc = docs[0];

    // Extract the snippet from the message: "alice sent you a message: "<snippet>""
    const prefix = 'alice sent you a message: "';
    expect(doc.message.startsWith(prefix)).toBe(true);
    expect(doc.message.endsWith('"')).toBe(true);

    const snippet = doc.message.slice(prefix.length, -1);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toBe(longText.slice(0, 137) + '…');

    expect(doc.eventDate.getTime()).toBe(msgDate.getTime());
    expect(doc.user).toBe('bob');

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('bob');
  });
});
