import { ObjectId } from 'mongodb';
import { NotificationItem, NotificationLocation, NotificationPriority } from '../../types/types';
import { testInternals } from '../../services/notificationFeed.service';

const { computeDigestGrouping, buildDigestLabel } = testInternals;

type NotificationWithSources = NotificationItem & {
  sources: NotificationLocation[];
};

// Helper to build a basic notification object
const makeBaseNotification = (
  overrides: Partial<NotificationWithSources> = {},
): NotificationWithSources => ({
  actor: 'alice',
  message: 'placeholder',
  eventDate: new Date('2024-01-01T10:00:00Z'),
  targetId: new ObjectId(),
  targetType: 'Question',
  location: 'collection',
  category: 'question',
  sources: ['collection'],
  ...overrides,
});

describe('notification digest grouping + labels', () => {
  describe('backfill (bookmarks) grouping', () => {
    it('groups backfill notifications by collection name and uses it in the label', () => {
      const notif = makeBaseNotification({
        category: 'backfill',
        location: 'collection',
        digestMeta: {
          collectionName: 'React Study Set',
        },
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      // Same collection + priority should yield a stable grouping key
      expect(key).toBe('normal:backfill:collection:React Study Set');
      expect(labelContext).toBe('your bookmarked collection "React Study Set"');

      const label = buildDigestLabel(
        2, // count
        notif.category,
        notif.location,
        priority,
        labelContext,
      );

      expect(label).toBe('2 updates in your bookmarked collection "React Study Set"');
    });

    it('groups backfill notifications by community name and uses it in the label', () => {
      const notif = makeBaseNotification({
        actor: 'bob',
        category: 'backfill',
        location: 'community',
        digestMeta: {
          communityName: 'Web Dev',
        },
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      expect(key).toBe('normal:backfill:community:Web Dev');
      expect(labelContext).toBe('your bookmarked community "Web Dev"');

      const label = buildDigestLabel(
        5, // count
        notif.category,
        notif.location,
        priority,
        labelContext,
      );

      expect(label).toBe('5 updates in your bookmarked community "Web Dev"');
    });

    it('handles collection/community backfill with both names present', () => {
      const notif = makeBaseNotification({
        actor: 'carol',
        category: 'backfill',
        location: 'collection/community',
        digestMeta: {
          collectionName: 'Algorithms',
          communityName: 'Interview Prep',
        },
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      expect(key).toBe('normal:backfill:collection-community:Algorithms:Interview Prep');
      expect(labelContext).toBe(
        'your bookmarked collection "Algorithms" and community "Interview Prep"',
      );

      const label = buildDigestLabel(3, notif.category, notif.location, priority, labelContext);

      expect(label).toBe(
        '3 updates in your bookmarked collection "Algorithms" and community "Interview Prep"',
      );
    });

    it('marks muted backfill groups explicitly in the label', () => {
      const notif = makeBaseNotification({
        category: 'backfill',
        location: 'collection',
        digestMeta: {
          collectionName: 'Muted Set',
        },
      });

      const priority: NotificationPriority | 'muted' = 'muted';

      const { labelContext } = computeDigestGrouping(notif, priority);

      const label = buildDigestLabel(4, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('4 updates in your bookmarked collection "Muted Set" (muted for you)');
    });

    it('falls back to generic backfill wording when there is no digestMeta', () => {
      const notif = makeBaseNotification({
        category: 'backfill',
        location: 'community',
        digestMeta: undefined,
      });

      const priority: NotificationPriority | 'muted' = 'normal';
      const { labelContext } = computeDigestGrouping(notif, priority);

      // No context → use the default location label
      const label = buildDigestLabel(2, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('2 updates in your bookmarked communities');
    });
  });

  describe('following / direct / follow-event grouping', () => {
    it('groups questions from people you follow by actor and labels them per-user', () => {
      const notif = makeBaseNotification({
        actor: 'dave',
        category: 'question',
        location: 'following',
        sources: ['following'],
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      expect(key).toBe('normal:question:following:dave');
      expect(labelContext).toBe('dave');

      const label = buildDigestLabel(2, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('2 questions from dave (people you follow)');
    });

    it('groups answers from people you follow by actor and labels them per-user', () => {
      const notif = makeBaseNotification({
        actor: 'erin',
        category: 'answer',
        location: 'following',
        sources: ['following'],
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      expect(key).toBe('normal:answer:following:erin');
      expect(labelContext).toBe('erin');

      const label = buildDigestLabel(1, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('1 answer from erin (people you follow)');
    });

    it('groups direct messages by sender and uses a direct-message label', () => {
      const notif = makeBaseNotification({
        actor: 'frank',
        category: 'direct',
        location: 'direct',
        sources: ['direct'],
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      expect(key).toBe('normal:direct:frank');
      expect(labelContext).toBe('frank');

      const label = buildDigestLabel(3, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('3 direct messages from frank');
    });

    it('groups follow events by follower and uses a follow-event label', () => {
      const notif = makeBaseNotification({
        actor: 'grace',
        category: 'follow',
        location: 'following',
        sources: ['following'],
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { key, labelContext } = computeDigestGrouping(notif, priority);

      expect(key).toBe('normal:follow:grace');
      expect(labelContext).toBe('grace');

      const label = buildDigestLabel(1, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('1 follow event from grace');
    });
  });

  describe('generic bookmark-driven Q/A labels', () => {
    it('uses question wording for community-based questions', () => {
      const notif = makeBaseNotification({
        category: 'question',
        location: 'community',
        sources: ['community'],
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { labelContext } = computeDigestGrouping(notif, priority);

      const label = buildDigestLabel(2, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('2 questions were posted in your bookmarked communities');
    });

    it('uses answer wording for collection-based answers', () => {
      const notif = makeBaseNotification({
        category: 'answer',
        location: 'collection',
        sources: ['collection'],
      });

      const priority: NotificationPriority | 'muted' = 'normal';

      const { labelContext } = computeDigestGrouping(notif, priority);

      const label = buildDigestLabel(4, notif.category, notif.location, priority, labelContext);

      expect(label).toBe('4 answers were posted in your bookmarked collections');
    });
  });
});
