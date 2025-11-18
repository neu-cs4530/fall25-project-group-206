// server/utils/backfillNotifications.util.ts
import { ObjectId } from 'mongodb';
import QuestionModel from '../models/questions.model';
import type { DatabaseCommunity } from '../types/types';
import type { PopulatedDatabaseCollection } from '../types/types';
import type { PopulatedDatabaseQuestion } from '../types/types';
import type { PopulatedDatabaseAnswer } from '../types/types';
import type { NotificationItem, NotificationLocation } from '../types/types';

/**
 * Internal helper: convert the set of flags into a single location string.
 */
function resolveLocation(flags: {
  inCollection: boolean;
  inCommunity: boolean;
}): NotificationLocation {
  if (flags.inCollection && flags.inCommunity) {
    return 'collection/community';
  }
  if (flags.inCollection) return 'collection';
  return 'community';
}

/**
 * Internal helper: build a question-level notification.
 */
function buildQuestionNotification(
  question: PopulatedDatabaseQuestion,
  location: NotificationLocation,
): NotificationItem {
  return {
    actor: question.askedBy,
    message: `${question.askedBy} posted a question "${question.title}" in your ${location}`,
    eventDate: question.askDateTime,
    targetId: question._id as ObjectId,
    targetType: 'Question',
    location,
    category: 'backfill',
  };
}

/**
 * Internal helper: build answer-level notifications for a single question.
 */
function buildAnswerNotifications(
  question: PopulatedDatabaseQuestion,
  location: NotificationLocation,
): NotificationItem[] {
  const answers = (question.answers || []) as PopulatedDatabaseAnswer[];

  return answers.map(ans => ({
    actor: ans.ansBy,
    message: `${ans.ansBy} posted an answer to "${question.title}" in your ${location}`,
    eventDate: ans.ansDateTime,
    targetId: question._id as ObjectId,
    targetType: 'Answer',
    location,
    category: 'backfill',
  }));
}

/**
 * Fetch all questions for the given communities, including their answers.
 *
 * NOTE: this is intentionally in a separate function so it is easy to
 * mock out in tests or swap out later if the schema changes.
 */
async function fetchQuestionsForCommunities(
  communities: DatabaseCommunity[],
): Promise<PopulatedDatabaseQuestion[]> {
  if (!communities.length) return [];

  const communityIds = communities.map(c => c._id);

  const questions = await QuestionModel.find({
    community: { $in: communityIds },
  })
    .populate<{ answers: PopulatedDatabaseAnswer[] }>('answers')
    .exec();

  return questions as unknown as PopulatedDatabaseQuestion[];
}

/**
 * Core backfill builder.
 *
 * It:
 *  1. Builds a combined set of questions from:
 *      - questions in the given collections (already populated)
 *      - questions belonging to the given communities (looked up via QuestionModel)
 *  2. Tracks where each question appears (collection / community / both).
 *  3. For each question:
 *      - emits one "asked question" notification
 *      - emits one notification per answer
 *  4. Sorts notifications newest → oldest.
 *
 * This function does NOT write to the DB. It only returns a list of
 * NotificationItem objects that the controller can return to the client
 * or optionally persist later.
 */
export async function buildBackfillNotificationsForUser(
  collections: PopulatedDatabaseCollection[],
  communities: DatabaseCommunity[],
): Promise<NotificationItem[]> {
  const notifications: NotificationItem[] = [];

  // Track "where" each question lives.
  // key = questionId string, value = { inCollection, inCommunity }
  const locations = new Map<string, { inCollection: boolean; inCommunity: boolean }>();

  // Map of questionId -> question object (merged from collections + communities).
  const questionById = new Map<string, PopulatedDatabaseQuestion>();

  // 1️⃣ From collections: questions are already populated in PopulatedDatabaseCollection.
  for (const collection of collections) {
    for (const q of collection.questions as PopulatedDatabaseQuestion[]) {
      const idStr = (q._id as ObjectId).toString();

      if (!locations.has(idStr)) {
        locations.set(idStr, { inCollection: false, inCommunity: false });
      }
      locations.get(idStr)!.inCollection = true;

      // If we see the same question multiple times (in multiple collections),
      // we just overwrite; the question data itself is identical.
      questionById.set(idStr, q);
    }
  }

  // 2️⃣ From communities: fetch questions (and their answers) by community id.
  const communityQuestions = await fetchQuestionsForCommunities(communities);

  for (const q of communityQuestions) {
    const idStr = (q._id as ObjectId).toString();

    if (!locations.has(idStr)) {
      locations.set(idStr, { inCollection: false, inCommunity: false });
    }
    locations.get(idStr)!.inCommunity = true;

    // If we already saw this question via collections, this will merge
    // any additional answer population from the DB.
    questionById.set(idStr, q);
  }

  // 3️⃣ Build notifications per question.
  for (const [qid, flags] of locations.entries()) {
    const question = questionById.get(qid);
    if (!question) continue;

    const location = resolveLocation(flags);

    // Question-level notification
    notifications.push(buildQuestionNotification(question, location));

    // Answer-level notifications
    notifications.push(...buildAnswerNotifications(question, location));
  }

  // 4️⃣ Sort newest → oldest
  notifications.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  return notifications;
}
