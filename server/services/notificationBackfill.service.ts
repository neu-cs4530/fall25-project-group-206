import BookmarkModel from '../models/bookmark.model';
import CollectionModel from '../models/collection.model';
import CommunityModel from '../models/community.model';
import QuestionModel from '../models/questions.model';
import AnswerModel from '../models/answers.model';
import NotificationModel from '../models/notification.model';

type TargetType = 'Question' | 'Answer' | 'Collection' | 'Community' | 'User';

/**
 * Generates a link URL based on target type and ID.
 * @param targetType
 * @param targetId
 * @param context
 * @returns
 */
function makeLink(
  targetType: TargetType,
  targetId: string,
  context?: { ownerUsername?: string },
): string {
  switch (targetType) {
    case 'Question':
      return `/questions/${targetId}`;
    case 'Answer':
      return `/answers/${targetId}`;
    case 'Collection':
      return `/collections/${context?.ownerUsername ?? 'unknown'}/${targetId}`;
    case 'Community':
      return `/communities/${targetId}`;
    case 'User':
      return `/users/${targetId}`;
    default:
      return '/';
  }
}

/**
 * Backfills notifications for a given user based on existing bookmarks.
 * Includes:
 *  - A base message for each bookmarked item (user/community/collection)
 *  - Recent questions and answers from bookmarked collections or communities
 */
export async function backfillUserNotifications(username: string): Promise<void> {
  console.log(`\n=== 🧩 Running backfill for ${username} ===`);

  // Fetch all current bookmarks
  const bookmarks = await BookmarkModel.find({ username });
  const currentTargetIds = bookmarks.map(b => b.targetId.toString());
  console.log(`📘 Found ${bookmarks.length} bookmarks for ${username}.`);
  console.log(`🗂️ Current target IDs: ${currentTargetIds.join(', ')}`);

  // Start with a clean slate for bookmark_backfill
  const delRes = await NotificationModel.deleteMany({
    user: username,
    category: 'bookmark_backfill',
  });
  console.log(`🧹 Removed ${delRes.deletedCount ?? 0} existing bookmark_backfill notifications.`);

  const notifications: any[] = [];

  for (const b of bookmarks) {
    let message = '';
    let eventDate = b.createdAt || new Date();

    // Keep these available for the base notification's link
    let collectionDoc: any | null = null;
    let communityDoc: any | null = null;

    console.log(`🔁 Processing bookmark ${b._id} (${b.targetType}) → ${b.targetId}`);

    if (b.targetType === 'Collection') {
      collectionDoc = await CollectionModel.findById(b.targetId);
      if (collectionDoc) {
        message = `You bookmarked the collection "${collectionDoc.name}".`;

        const relatedQuestions = await QuestionModel.find({
          _id: { $in: collectionDoc.questions },
        })
          .sort({ askDateTime: -1 })
          .limit(5);

        for (const q of relatedQuestions) {
          notifications.push({
            user: username,
            message: `New question "${q.title}" in your bookmarked collection "${collectionDoc.name}".`,
            category: 'bookmark_backfill',
            targetId: q._id,
            targetType: 'Question',
            isRead: false,
            eventDate: q.askDateTime || new Date(),
            createdAt: new Date(),
            link: makeLink('Question', q._id.toString()),
          });

          const recentAnswers = await AnswerModel.find({ _id: { $in: q.answers } })
            .sort({ ansDateTime: -1 })
            .limit(3);

          for (const a of recentAnswers) {
            notifications.push({
              user: username,
              message: `${a.ansBy} answered "${q.title}" in your bookmarked collection "${collectionDoc.name}".`,
              category: 'bookmark_backfill',
              targetId: a._id,
              targetType: 'Answer',
              isRead: false,
              eventDate: a.ansDateTime || new Date(),
              createdAt: new Date(),
              link: makeLink('Answer', a._id.toString()),
            });
          }
        }

        if (relatedQuestions.length > 0 && relatedQuestions[0].askDateTime) {
          eventDate = relatedQuestions[0].askDateTime;
          console.log(`   📅 Latest question date for "${collectionDoc.name}" is ${eventDate}`);
        }
      } else {
        // Collection missing (deleted?) – set a fallback message
        message = 'You bookmarked a collection.';
      }
    } else if (b.targetType === 'Community') {
      communityDoc = await CommunityModel.findById(b.targetId);
      message = communityDoc
        ? `You bookmarked the community "${communityDoc.name}".`
        : 'You bookmarked a community.';

      const recentQuestions = await QuestionModel.find({ community: b.targetId })
        .sort({ askDateTime: -1 })
        .limit(5);

      for (const q of recentQuestions) {
        notifications.push({
          user: username,
          message: `${q.askedBy} posted "${q.title}" in a community you bookmarked.`,
          category: 'bookmark_backfill',
          targetId: q._id,
          targetType: 'Question',
          isRead: false,
          eventDate: q.askDateTime || new Date(),
          createdAt: new Date(),
          link: makeLink('Question', q._id.toString()),
        });

        const recentAnswers = await AnswerModel.find({ _id: { $in: q.answers } })
          .sort({ ansDateTime: -1 })
          .limit(3);

        for (const a of recentAnswers) {
          notifications.push({
            user: username,
            message: `${a.ansBy} answered "${q.title}" in a community you bookmarked.`,
            category: 'bookmark_backfill',
            targetId: a._id,
            targetType: 'Answer',
            isRead: false,
            eventDate: a.ansDateTime || new Date(),
            createdAt: new Date(),
            link: makeLink('Answer', a._id.toString()),
          });
        }
      }
    } else if (b.targetType === 'User') {
      message = 'You bookmarked a user.';
    }

    // Base notification for the bookmark itself
    notifications.push({
      user: username,
      message: message || `Bookmarked a ${b.targetType}.`,
      category: 'bookmark_backfill',
      targetId: b.targetId,
      targetType: b.targetType,
      isRead: false,
      eventDate: b.createdAt || new Date(),
      createdAt: new Date(),
      link: makeLink(
        b.targetType,
        b.targetId.toString(),
        collectionDoc ? { ownerUsername: collectionDoc.ownerUsername } : undefined,
      ),
    });
  }

  if (notifications.length > 0) {
    await NotificationModel.insertMany(notifications);
    console.log(`✅ Backfilled ${notifications.length} notifications for ${username}.`);
  } else {
    console.log(`ℹ️ No bookmarks found to backfill for ${username}.`);
  }

  console.log(`=== ✅ Backfill complete for ${username} ===\n`);
}

export default backfillUserNotifications;
