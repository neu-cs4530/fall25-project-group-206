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
 * Human-readable phrase for where the activity happened.
 *
 * Preference:
 *  1. If we know the community name, say: the "<name>" community
 *  2. Else, if this is collection-only and we know a collection name:
 *       the "<name>" collection
 *  3. Otherwise, fall back to generic wording based on NotificationLocation.
 */
function describeQuestionLocation(
  question: PopulatedDatabaseQuestion,
  questionIdStr: string,
  location: NotificationLocation,
  communitiesById: Map<string, DatabaseCommunity>,
  collectionsByQuestionId: Map<string, string[]>,
): string {
  // 1️⃣ Try to use a collection name if this notification involves a collection
  //    (either collection-only or collection/community).
  if (location === 'collection' || location === 'collection/community') {
    const collectionNames = collectionsByQuestionId.get(questionIdStr);
    const firstCollectionName = collectionNames?.[0]?.trim();

    if (firstCollectionName) {
      // For both 'collection' and 'collection/community', prefer:
      //   the "<collectionName>" collection
      return `the "${firstCollectionName}" collection`;
    }
  }

  // 2️⃣ Otherwise, fall back to community name if we have one.
  const rawCommunityId = question.community as ObjectId | undefined | null;
  if (rawCommunityId) {
    const community = communitiesById.get(rawCommunityId.toString());
    const communityName = community?.name;
    if (communityName && communityName.trim().length > 0) {
      return `the "${communityName}" community`;
    }
  }

  // 3️⃣ Generic fallbacks based on location.
  if (location === 'collection') return 'your collection';
  if (location === 'collection/community') return 'your collection and community';
  return 'your community';
}

/**
 * Internal helper: build a question-level notification.
 */
function buildQuestionNotification(
  question: PopulatedDatabaseQuestion,
  questionIdStr: string,
  location: NotificationLocation,
  communitiesById: Map<string, DatabaseCommunity>,
  collectionsByQuestionId: Map<string, string[]>,
): NotificationItem {
  const locationPhrase = describeQuestionLocation(
    question,
    questionIdStr,
    location,
    communitiesById,
    collectionsByQuestionId,
  );

  return {
    actor: question.askedBy,
    message: `${question.askedBy} posted a question "${question.title}" in ${locationPhrase}`,
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
  questionIdStr: string,
  location: NotificationLocation,
  communitiesById: Map<string, DatabaseCommunity>,
  collectionsByQuestionId: Map<string, string[]>,
): NotificationItem[] {
  const answers = (question.answers || []) as PopulatedDatabaseAnswer[];
  const locationPhrase = describeQuestionLocation(
    question,
    questionIdStr,
    location,
    communitiesById,
    collectionsByQuestionId,
  );

  return answers.map(ans => ({
    actor: ans.ansBy,
    message: `${ans.ansBy} posted an answer to "${question.title}" in ${locationPhrase}`,
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

  // Map communityId -> community object (for names)
  const communitiesById = new Map<string, DatabaseCommunity>();
  for (const c of communities) {
    communitiesById.set((c._id as ObjectId).toString(), c);
  }

  // Map questionId -> array of collection names that contain it
  const collectionsByQuestionId = new Map<string, string[]>();

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

      // Track the names of collections that include this question.
      const existingNames = collectionsByQuestionId.get(idStr) ?? [];
      if (!existingNames.includes(collection.name)) {
        existingNames.push(collection.name);
      }
      collectionsByQuestionId.set(idStr, existingNames);

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
    notifications.push(
      buildQuestionNotification(question, qid, location, communitiesById, collectionsByQuestionId),
    );

    // Answer-level notifications
    notifications.push(
      ...buildAnswerNotifications(
        question,
        qid,
        location,
        communitiesById,
        collectionsByQuestionId,
      ),
    );
  }

  // 4️⃣ Sort newest → oldest
  notifications.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  return notifications;
}
