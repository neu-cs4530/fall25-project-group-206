import mongoose from 'mongoose';
import QuestionModel from '../../models/questions.model';
import buildBackfillNotificationsForUser from '../../utils/backfillNotifications.util';

import type { PopulatedDatabaseCollection } from '../../../shared/types/collection';
import type { DatabaseCommunity } from '../../../shared/types/community';
import type { PopulatedDatabaseQuestion } from '../../../shared/types/question';
import type { PopulatedDatabaseAnswer } from '../../../shared/types/answer';
import type { NotificationItem } from '../../../shared/types/notification';

describe('buildBackfillNotificationsForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty array when there are no collections or communities', async () => {
    const findSpy = jest.spyOn(QuestionModel, 'find');

    const result = await buildBackfillNotificationsForUser([], []);

    expect(result).toEqual([]);
    expect(findSpy).not.toHaveBeenCalled();
  });

  test('merges questions from collections and communities, tags locations, and includes digest meta', async () => {
    // Set up ObjectIds for questions and community
    const q1Id = new mongoose.Types.ObjectId();
    const q2Id = new mongoose.Types.ObjectId();
    const q3Id = new mongoose.Types.ObjectId();
    const communityId = new mongoose.Types.ObjectId();

    // Answers for each question
    const q1Answer: PopulatedDatabaseAnswer = {
      _id: new mongoose.Types.ObjectId(),
      text: 'Answer to Q1',
      ansBy: 'answerUser1',
      ansDateTime: new Date('2024-01-02T12:00:00Z'),
      comments: [],
    };

    const q2Answer: PopulatedDatabaseAnswer = {
      _id: new mongoose.Types.ObjectId(),
      text: 'Answer to Q2',
      ansBy: 'answerUser2',
      ansDateTime: new Date('2024-01-03T13:00:00Z'),
      comments: [],
    };

    const q3Answer: PopulatedDatabaseAnswer = {
      _id: new mongoose.Types.ObjectId(),
      text: 'Answer to Q3',
      ansBy: 'answerUser3',
      ansDateTime: new Date('2024-01-04T14:00:00Z'),
      comments: [],
    };

    // Q1: only in a collection
    const q1: PopulatedDatabaseQuestion = {
      _id: q1Id,
      title: 'Question 1',
      text: 'How to do Q1?',
      tags: [],
      answers: [q1Answer],
      askedBy: 'asker1',
      askDateTime: new Date('2024-01-01T10:00:00Z'),
      views: [],
      upVotes: [],
      downVotes: [],
      comments: [],
      community: null,
    };

    // Q2: in BOTH collection and community (we do not use community name here)
    const q2: PopulatedDatabaseQuestion = {
      _id: q2Id,
      title: 'Question 2',
      text: 'How to do Q2?',
      tags: [],
      answers: [q2Answer],
      askedBy: 'asker2',
      askDateTime: new Date('2024-01-02T11:00:00Z'),
      views: [],
      upVotes: [],
      downVotes: [],
      comments: [],
      community: null,
    };

    // Q3: ONLY in community, with an actual community id
    const q3: PopulatedDatabaseQuestion = {
      _id: q3Id,
      title: 'Question 3',
      text: 'How to do Q3?',
      tags: [],
      answers: [q3Answer],
      askedBy: 'asker3',
      askDateTime: new Date('2024-01-03T11:30:00Z'),
      views: [],
      upVotes: [],
      downVotes: [],
      comments: [],
      // Store as ObjectId at runtime, but satisfy TS with a cast
      community: communityId as unknown as DatabaseCommunity,
    };

    // One collection that includes Q1 and Q2
    const collections: PopulatedDatabaseCollection[] = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'My Collection',
        description: 'Test collection',
        username: 'ownerUser',
        isPrivate: false,
        questions: [q1, q2],
      },
    ];

    // One community that will be used to fetch Q2 and Q3
    const communities: DatabaseCommunity[] = [
      {
        _id: communityId,
        name: 'My Community',
        description: 'Test community',
        visibility: 'PUBLIC',
        participants: ['ownerUser'],
        admin: 'ownerUser',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    // Mock QuestionModel.find(...) to return Q2 and Q3 for the community.
    const findSpy = jest.spyOn(QuestionModel, 'find').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([q2, q3]),
    } as unknown as ReturnType<typeof QuestionModel.find>);

    const notifications = await buildBackfillNotificationsForUser(collections, communities);

    // Ensure we hit the DB for community questions
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).toHaveBeenCalledWith({
      community: { $in: [communityId] },
    });

    // We expect for each question:
    //  - 1 "question" notification
    //  - 1 "answer" notification
    // → 3 questions * 2 = 6 notifications
    expect(notifications).toHaveLength(6);

    // Group notifications by question id string
    const groupedByQuestion: Record<string, NotificationItem[]> = {};
    for (const n of notifications) {
      const key = (n.targetId as mongoose.Types.ObjectId).toString();
      if (!groupedByQuestion[key]) groupedByQuestion[key] = [];
      groupedByQuestion[key].push(n);
    }

    const q1Key = q1Id.toString();
    const q2Key = q2Id.toString();
    const q3Key = q3Id.toString();

    // 1) Q1: only in collection
    const q1Notifs = groupedByQuestion[q1Key];
    expect(q1Notifs).toBeDefined();
    expect(q1Notifs).toHaveLength(2);
    q1Notifs.forEach(n => {
      expect(n.location).toBe('collection');
    });
    expect(q1Notifs.some(n => n.targetType === 'Question')).toBe(true);
    expect(q1Notifs.some(n => n.targetType === 'Answer')).toBe(true);

    // 2) Q2: in collection AND community
    const q2Notifs = groupedByQuestion[q2Key];
    expect(q2Notifs).toBeDefined();
    expect(q2Notifs).toHaveLength(2);
    q2Notifs.forEach(n => {
      expect(n.location).toBe('collection/community');
    });

    // 3) Q3: only in community – should use community name in phrase + digestMeta
    const q3Notifs = groupedByQuestion[q3Key];
    expect(q3Notifs).toBeDefined();
    expect(q3Notifs).toHaveLength(2);
    q3Notifs.forEach(n => {
      expect(n.location).toBe('community');
    });

    const q3QuestionNotif = q3Notifs.find(n => n.targetType === 'Question') as NotificationItem;
    expect(q3QuestionNotif).toBeDefined();
    // location phrase should be the "My Community" community
    expect(q3QuestionNotif.message).toContain('the "My Community" community');
    // digestMeta should include communityName (exercises BackfillDigestMeta community branch)
    expect((q3QuestionNotif as any).digestMeta?.communityName).toBe('My Community');

    // Spot-check actors and messages for Q2
    const q2QuestionNotif = q2Notifs.find(n => n.targetType === 'Question');
    const q2AnswerNotif = q2Notifs.find(n => n.targetType === 'Answer');

    expect(q2QuestionNotif).toBeDefined();
    expect(q2QuestionNotif?.actor).toBe('asker2');
    expect(q2QuestionNotif?.message).toContain('asker2');
    expect(q2QuestionNotif?.message).toContain('Question 2');

    expect(q2AnswerNotif).toBeDefined();
    expect(q2AnswerNotif?.actor).toBe('answerUser2');
    expect(q2AnswerNotif?.message).toContain('answerUser2');
    expect(q2AnswerNotif?.message).toContain('Question 2');

    // Ensure notifications are sorted newest → oldest by eventDate
    for (let i = 1; i < notifications.length; i += 1) {
      const prev = notifications[i - 1].eventDate.getTime();
      const curr = notifications[i].eventDate.getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test('uses generic fallback phrases when names are missing', async () => {
    const communityId = new mongoose.Types.ObjectId();

    // Qc: only in a collection, no collection name → "your collection"
    const qc: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Collection-only',
      text: 'Q in collection only',
      tags: [],
      answers: [],
      askedBy: 'askerC',
      askDateTime: new Date('2024-02-01T10:00:00Z'),
      views: [],
      upVotes: [],
      downVotes: [],
      comments: [],
      community: null,
    };

    // Qcc: in collection AND community, but both names blank → "your collection and community"
    const qcc: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Collection and community',
      text: 'Q in both, no names',
      tags: [],
      answers: [],
      askedBy: 'askerCC',
      askDateTime: new Date('2024-02-01T11:00:00Z'),
      views: [],
      upVotes: [],
      downVotes: [],
      comments: [],
      community: communityId as unknown as DatabaseCommunity,
    };

    // Qcomm: only in community, blank community name → "your community"
    const qcomm: PopulatedDatabaseQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Community-only',
      text: 'Q in community only',
      tags: [],
      answers: [],
      askedBy: 'askerComm',
      askDateTime: new Date('2024-02-01T12:00:00Z'),
      views: [],
      upVotes: [],
      downVotes: [],
      comments: [],
      community: communityId as unknown as DatabaseCommunity,
    };

    // Collection with whitespace-only name so collection name branch fails
    const collections: PopulatedDatabaseCollection[] = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: '   ', // whitespace → .trim() === '' → triggers generic fallbacks
        description: 'Nameless collection',
        username: 'ownerUser',
        isPrivate: false,
        questions: [qc, qcc],
      },
    ];

    // Community with whitespace-only name so community name branch fails
    const communities: DatabaseCommunity[] = [
      {
        _id: communityId,
        name: '   ', // whitespace → .trim() === '' → triggers generic community fallback
        description: 'Nameless community',
        visibility: 'PUBLIC',
        participants: ['ownerUser'],
        admin: 'ownerUser',
        createdAt: new Date('2024-02-01T00:00:00Z'),
        updatedAt: new Date('2024-02-01T00:00:00Z'),
      },
    ];

    // fetchQuestionsForCommunities should return qcc and qcomm
    jest.spyOn(QuestionModel, 'find').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([qcc, qcomm]),
    } as unknown as ReturnType<typeof QuestionModel.find>);

    const notifications = await buildBackfillNotificationsForUser(collections, communities);

    // Group notifications by question id string
    const groupedByQuestion: Record<string, NotificationItem[]> = {};
    for (const n of notifications) {
      const key = (n.targetId as mongoose.Types.ObjectId).toString();
      if (!groupedByQuestion[key]) groupedByQuestion[key] = [];
      groupedByQuestion[key].push(n);
    }

    const qcKey = qc._id.toString();
    const qccKey = qcc._id.toString();
    const qcommKey = qcomm._id.toString();

    const qcNotifs = groupedByQuestion[qcKey];
    const qccNotifs = groupedByQuestion[qccKey];
    const qcommNotifs = groupedByQuestion[qcommKey];

    const qcQuestionNotif = qcNotifs.find(n => n.targetType === 'Question') as NotificationItem;
    const qccQuestionNotif = qccNotifs.find(n => n.targetType === 'Question') as NotificationItem;
    const qcommQuestionNotif = qcommNotifs.find(
      n => n.targetType === 'Question',
    ) as NotificationItem;

    // These three expectations exercise the generic fallback branches:
    //  - location === 'collection'            → 'your collection'
    //  - location === 'collection/community' → 'your collection and community'
    //  - default (community only)            → 'your community'
    expect(qcQuestionNotif.location).toBe('collection');
    expect(qcQuestionNotif.message).toContain('in your collection');

    expect(qccQuestionNotif.location).toBe('collection/community');
    expect(qccQuestionNotif.message).toContain('in your collection and community');

    expect(qcommQuestionNotif.location).toBe('community');
    expect(qcommQuestionNotif.message).toContain('in your community');
  });
});
