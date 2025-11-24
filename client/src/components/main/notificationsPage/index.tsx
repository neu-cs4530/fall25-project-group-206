import './index.css';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect, useCallback } from 'react';
import useNotificationsPage from '../../../hooks/useNotificationsPage';
import NotificationPreferencesPanel from './NotificationPreferencesPanel';
import type {
  NotificationItem,
  NotificationPriority,
  NotificationDigestResponse,
  NotificationDigestItem,
  DigestPriority,
} from '../../../types/types';
import useUserContext from '../../../hooks/useUserContext';
import { fetchNotificationDigest } from '../../../services/notificationService';

/**
 * Normalize undefined priority to 'normal' for filtering.
 */
const getEffectivePriority = (item: NotificationItem): NotificationPriority =>
  item.priority ?? 'normal';

type DigestReason =
  | 'following'
  | 'follow-events'
  | 'direct-messages'
  | 'bookmarked-collections'
  | 'bookmarked-communities'
  | 'bookmarked-collections-and-communities'
  | 'other';

const getEffectiveSourcesForDigest = (n: NotificationItem): NotificationItem['location'][] => {
  if (n.sources && n.sources.length > 0) {
    return n.sources;
  }
  return [n.location];
};

const classifyDigestReason = (group: NotificationDigestItem): DigestReason => {
  const items = group.notifications;

  if (!items.length) {
    return 'other';
  }

  // If everything is a follow event, call it follow events.
  const allFollow = items.every(n => n.category === 'follow');
  if (allFollow) {
    return 'follow-events';
  }

  // If everything is direct/DM, treat as direct messages.
  const allDirect = items.every(n => n.location === 'direct' || n.category === 'direct');
  if (allDirect) {
    return 'direct-messages';
  }

  let hasFollowing = false;
  let hasCollection = false;
  let hasCommunity = false;

  for (const n of items) {
    const sources = getEffectiveSourcesForDigest(n);

    if (sources.includes('following')) {
      hasFollowing = true;
    }
    if (sources.some(s => s === 'collection' || s === 'collection/community')) {
      hasCollection = true;
    }
    if (sources.some(s => s === 'community' || s === 'collection/community')) {
      hasCommunity = true;
    }
  }

  if (hasFollowing && !hasCollection && !hasCommunity) {
    return 'following';
  }

  if (!hasFollowing && hasCollection && hasCommunity) {
    return 'bookmarked-collections-and-communities';
  }

  if (!hasFollowing && hasCollection) {
    return 'bookmarked-collections';
  }

  if (!hasFollowing && hasCommunity) {
    return 'bookmarked-communities';
  }

  if (hasFollowing && (hasCollection || hasCommunity)) {
    // Mixed case: following + bookmarks; still feels closest to "following".
    return 'following';
  }

  return 'other';
};

const plural = (count: number, singular: string, pluralForm: string): string =>
  count === 1 ? singular : pluralForm;

/**
 * Builds a human-readable title for a digest group based on *why* the
 * notifications were grouped (following vs bookmarks vs follows vs DMs).
 */
const buildDigestTitle = (group: NotificationDigestItem): string => {
  if (group.label && group.label.trim().length > 0) {
    return group.label;
  }

  // ⬇️ Old logic kept as a fallback (for safety / older servers)
  const count = group.count;
  const reason = classifyDigestReason(group);

  switch (reason) {
    case 'following': {
      const hasQuestions = group.notifications.some(n => n.category === 'question');
      const hasAnswers = group.notifications.some(n => n.category === 'answer');

      if (hasQuestions && !hasAnswers) {
        return `${count} ${plural(count, 'question', 'questions')} from people you follow`;
      }
      if (!hasQuestions && hasAnswers) {
        return `${count} ${plural(count, 'answer', 'answers')} from people you follow`;
      }
      return `${count} ${plural(count, 'notification', 'notifications')} from people you follow`;
    }

    case 'follow-events':
      return `${count} follow ${plural(count, 'event', 'events')}`;

    case 'direct-messages':
      return `${count} direct ${plural(count, 'message', 'messages')}`;

    case 'bookmarked-collections':
      return `${count} ${plural(count, 'update', 'updates')} in your bookmarked collections`;

    case 'bookmarked-communities':
      return `${count} ${plural(count, 'update', 'updates')} in your bookmarked communities`;

    case 'bookmarked-collections-and-communities':
      return `${count} ${plural(
        count,
        'update',
        'updates',
      )} in bookmarked collections and communities`;

    case 'other':
    default:
      return `${count} notification${count === 1 ? '' : 's'}`;
  }
};

const NotificationsPage = () => {
  const { notifications, loading, error, refetch } = useNotificationsPage();
  const { user } = useUserContext();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'feed' | 'preferences' | 'digest'>('feed');
  const [priorityFilter, setPriorityFilter] = useState<'highOnly' | 'normalPlusHigh' | 'all'>(
    'all',
  );

  // Digest state
  const [digest, setDigest] = useState<NotificationDigestResponse | null>(null);
  const [digestLoading, setDigestLoading] = useState<boolean>(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [digestPriority, setDigestPriority] = useState<DigestPriority>('high');
  const [expandedDigestIds, setExpandedDigestIds] = useState<Set<string>>(new Set());

  const loadDigest = useCallback(async () => {
    if (!user?.username) {
      setDigest(null);
      setDigestLoading(false);
      setDigestError(null);
      return;
    }

    setDigestLoading(true);
    setDigestError(null);

    try {
      const data = await fetchNotificationDigest(user.username);
      setDigest(data);
    } catch (err) {
      setDigestError((err as Error).message || 'Failed to fetch notification digest');
    } finally {
      setDigestLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    if (viewMode === 'digest') {
      void loadDigest();
    }
  }, [viewMode, loadDigest]);

  const toggleDigestExpanded = (id: string) => {
    setExpandedDigestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getTargetIdString = (targetId: NotificationItem['targetId']): string => {
    if (typeof targetId === 'string') {
      return targetId;
    }

    return (targetId as unknown as { toString: () => string }).toString();
  };

  const handleClick = (notification: NotificationItem) => {
    if (notification.link) {
      navigate(notification.link);
      return;
    }

    navigate(`/question/${getTargetIdString(notification.targetId)}`);
  };

  const formatRelativeTime = (value: Date | string | null | undefined) => {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

    return date.toLocaleString();
  };

  const makeKey = (n: NotificationItem, index: number): string => {
    if (n._id) {
      return (n._id as unknown as { toString: () => string }).toString();
    }

    const targetIdStr = getTargetIdString(n.targetId);
    const eventTime = new Date(n.eventDate as unknown as Date | string).getTime();

    return [
      'notif',
      targetIdStr,
      n.targetType,
      n.actor,
      Number.isNaN(eventTime) ? 'noTime' : eventTime,
      index,
    ].join(':');
  };

  const formatLocationLabel = (src: NotificationItem['location']): string => {
    if (src === 'collection/community') {
      return 'collection & community';
    }
    return src;
  };

  const filteredNotifications: NotificationItem[] = useMemo(() => {
    if (!notifications || notifications.length === 0) {
      return [];
    }

    return notifications.filter(n => {
      const p = getEffectivePriority(n);

      if (priorityFilter === 'highOnly') {
        return p === 'high';
      }

      if (priorityFilter === 'normalPlusHigh') {
        return p === 'high' || p === 'normal';
      }

      return true;
    });
  }, [notifications, priorityFilter]);

  const hasAnyNotifications = (notifications?.length ?? 0) > 0;
  const hasFilteredNotifications = filteredNotifications.length > 0;

  const currentDigestItems: NotificationDigestItem[] = useMemo(() => {
    if (!digest) {
      return [];
    }

    switch (digestPriority) {
      case 'high':
        return digest.high;
      case 'normal':
        return digest.normal;
      case 'low':
        return digest.low;
      case 'muted':
        return digest.muted;
      default:
        return [];
    }
  }, [digest, digestPriority]);

  /**
   * VIEW: Preferences
   */
  if (viewMode === 'preferences') {
    return <NotificationPreferencesPanel onClose={() => setViewMode('feed')} />;
  }

  /**
   * VIEW: Digest
   */
  if (viewMode === 'digest') {
    const hasAnyDigest =
      digest &&
      (digest.high.length || digest.normal.length || digest.low.length || digest.muted.length);

    const hasCurrentDigestItems = (currentDigestItems?.length ?? 0) > 0;

    return (
      <div className='notifications-page'>
        <div className='notifications-header'>
          <h2>Notification Digest</h2>
          <div className='notifications-header-buttons'>
            <div className='notifications-priority-filters'>
              <button
                type='button'
                className={
                  digestPriority === 'high' ? 'notifications-filter active' : 'notifications-filter'
                }
                onClick={() => setDigestPriority('high')}>
                High
              </button>
              <button
                type='button'
                className={
                  digestPriority === 'normal'
                    ? 'notifications-filter active'
                    : 'notifications-filter'
                }
                onClick={() => setDigestPriority('normal')}>
                Normal
              </button>
              <button
                type='button'
                className={
                  digestPriority === 'low' ? 'notifications-filter active' : 'notifications-filter'
                }
                onClick={() => setDigestPriority('low')}>
                Low
              </button>
              <button
                type='button'
                className={
                  digestPriority === 'muted'
                    ? 'notifications-filter active'
                    : 'notifications-filter'
                }
                onClick={() => setDigestPriority('muted')}>
                Muted
              </button>
            </div>
            <button
              type='button'
              className='notifications-refresh'
              onClick={() => {
                setExpandedDigestIds(new Set());
                void loadDigest();
              }}>
              Refresh digest
            </button>
            <button type='button' onClick={() => setViewMode('feed')}>
              Back to Feed
            </button>
          </div>
        </div>

        {digestLoading && <p>Loading digest...</p>}

        {digestError && (
          <div className='notifications-error'>
            <span>{digestError}</span>
          </div>
        )}

        {!digestLoading && !digestError && !hasAnyDigest && (
          <p className='notifications-empty'>
            You do not have any notifications yet to build a digest.
          </p>
        )}

        {!digestLoading && !digestError && hasAnyDigest && !hasCurrentDigestItems && (
          <p className='notifications-empty'>No digest groups for the selected priority.</p>
        )}

        {!digestLoading && !digestError && hasCurrentDigestItems && (
          <ul className='notifications-list'>
            {currentDigestItems.map(group => {
              const isExpanded = expandedDigestIds.has(group.id);
              const itemCount = group.count;

              return (
                <li key={group.id} className='notification-card digest-card'>
                  <div
                    className='notification-digest-header'
                    onClick={() => toggleDigestExpanded(group.id)}>
                    <div className='notification-message'>{buildDigestTitle(group)}</div>
                    <div className='notification-meta'>
                      <span
                        className={`notification-priority badge-priority-${
                          group.priority === 'muted' ? 'low' : group.priority
                        }`}>
                        {group.priority}
                      </span>
                      <span className='notification-separator'>•</span>
                      <span>
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <ul className='notifications-sub-list'>
                      {group.notifications.map((n, index) => {
                        const key = makeKey(n, index);

                        const effectiveSources =
                          n.sources && n.sources.length > 0 ? n.sources : [n.location];

                        const hasFollowing = effectiveSources.includes('following');
                        const hasCollectionSource = effectiveSources.some(
                          src => src === 'collection' || src === 'collection/community',
                        );
                        const hasCommunitySource = effectiveSources.some(
                          src => src === 'community' || src === 'collection/community',
                        );
                        const hasBookmarkSource = hasCollectionSource || hasCommunitySource;

                        let displayMessage = n.message;

                        if (
                          (n.category === 'question' || n.category === 'answer') &&
                          hasFollowing &&
                          hasBookmarkSource
                        ) {
                          const meta = n.digestMeta;
                          const whereParts: string[] = [];

                          if (hasCollectionSource) {
                            if (meta?.collectionName && meta.collectionName.trim().length > 0) {
                              whereParts.push(`the "${meta.collectionName.trim()}" collection`);
                            } else {
                              whereParts.push('a collection');
                            }
                          }

                          if (hasCommunitySource) {
                            if (meta?.communityName && meta.communityName.trim().length > 0) {
                              whereParts.push(`the "${meta.communityName.trim()}" community`);
                            } else {
                              whereParts.push('a community');
                            }
                          }

                          const whereLabel =
                            whereParts.length === 2
                              ? `${whereParts[0]} and ${whereParts[1]}`
                              : whereParts[0];

                          const action =
                            n.category === 'question'
                              ? 'posted a new question'
                              : 'posted a new answer';

                          displayMessage = `${n.actor} ${action} in ${whereLabel} you have bookmarked.`;
                        }

                        const eventDateValue = n.eventDate as unknown as Date | string;
                        const targetTypeLabel = n.targetType
                          ? n.targetType.toLowerCase()
                          : 'activity';

                        const priorityLabel = getEffectivePriority(n);

                        return (
                          <li
                            key={key}
                            className='notification-card notification-sub-card'
                            onClick={() => handleClick(n)}>
                            <div className='notification-message'>{displayMessage}</div>
                            <div className='notification-meta'>
                              <span className='notification-actor'>by {n.actor}</span>
                              <span className='notification-separator'>•</span>
                              <span className='notification-time'>
                                {formatRelativeTime(eventDateValue)}
                              </span>
                              <span className='notification-separator'>•</span>

                              <span className='notification-sources'>
                                {effectiveSources.map((src, srcIndex) => {
                                  const slug = src.replace('/', '-');
                                  return (
                                    <span
                                      key={`${key}-src-${src}-${srcIndex}`}
                                      className={`notification-location badge-${slug}`}>
                                      {formatLocationLabel(src)}
                                    </span>
                                  );
                                })}
                              </span>

                              <span className='notification-separator'>•</span>
                              <span
                                className={`notification-type badge-${(
                                  n.targetType ?? 'activity'
                                ).toLowerCase()}`}>
                                {targetTypeLabel}
                              </span>

                              <span className='notification-separator'>•</span>
                              <span
                                className={`notification-priority badge-priority-${priorityLabel}`}>
                                {priorityLabel}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  /**
   * VIEW: Feed (default)
   */
  if (loading) {
    return (
      <div className='notifications-page'>
        <div className='notifications-header'>
          <h2>Notifications</h2>
          <div className='notifications-header-buttons'>
            <button type='button' disabled>
              Loading...
            </button>
            <button type='button' onClick={() => setViewMode('preferences')}>
              Preferences
            </button>
          </div>
        </div>
        <p>Loading notifications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='notifications-page'>
        <div className='notifications-header'>
          <h2>Notifications</h2>
          <div className='notifications-header-buttons'>
            <button type='button' onClick={refetch}>
              Retry
            </button>
            <button type='button' onClick={() => setViewMode('preferences')}>
              Preferences
            </button>
          </div>
        </div>
        <div className='notifications-error'>
          <span>Failed to load notifications: {error}</span>
        </div>
      </div>
    );
  }

  // Single feed view: header + filters always visible.
  return (
    <div className='notifications-page'>
      <div className='notifications-header'>
        <h2>Notifications</h2>
        <div className='notifications-header-buttons'>
          <div className='notifications-priority-filters'>
            <button
              type='button'
              className={
                priorityFilter === 'highOnly'
                  ? 'notifications-filter active'
                  : 'notifications-filter'
              }
              onClick={() => setPriorityFilter('highOnly')}>
              High
            </button>
            <button
              type='button'
              className={
                priorityFilter === 'normalPlusHigh'
                  ? 'notifications-filter active'
                  : 'notifications-filter'
              }
              onClick={() => setPriorityFilter('normalPlusHigh')}>
              Normal & High
            </button>
            <button
              type='button'
              className={
                priorityFilter === 'all' ? 'notifications-filter active' : 'notifications-filter'
              }
              onClick={() => setPriorityFilter('all')}>
              All
            </button>
          </div>
          <button type='button' className='notifications-refresh' onClick={refetch}>
            Refresh
          </button>
          <button type='button' onClick={() => setViewMode('digest')}>
            Digest
          </button>
          <button type='button' onClick={() => setViewMode('preferences')}>
            Preferences
          </button>
        </div>
      </div>

      {/* Empty-state messages */}
      {!hasAnyNotifications && (
        <p className='notifications-empty'>
          You do not have any notifications yet. Bookmark collections or communities to see activity
          here.
        </p>
      )}

      {hasAnyNotifications && !hasFilteredNotifications && (
        <p className='notifications-empty'>No notifications match the current priority filter.</p>
      )}

      {/* Actual list */}
      {hasFilteredNotifications && (
        <ul className='notifications-list'>
          {filteredNotifications.map((n, index) => {
            const key = makeKey(n, index);

            const effectiveSources = n.sources && n.sources.length > 0 ? n.sources : [n.location];

            const hasFollowing = effectiveSources.includes('following');
            const hasCollectionSource = effectiveSources.some(
              src => src === 'collection' || src === 'collection/community',
            );
            const hasCommunitySource = effectiveSources.some(
              src => src === 'community' || src === 'collection/community',
            );
            const hasBookmarkSource = hasCollectionSource || hasCommunitySource;

            let displayMessage = n.message;

            if (
              (n.category === 'question' || n.category === 'answer') &&
              hasFollowing &&
              hasBookmarkSource
            ) {
              const meta = n.digestMeta;
              const whereParts: string[] = [];

              if (hasCollectionSource) {
                if (meta?.collectionName && meta.collectionName.trim().length > 0) {
                  whereParts.push(`the "${meta.collectionName.trim()}" collection`);
                } else {
                  whereParts.push('a collection');
                }
              }

              if (hasCommunitySource) {
                if (meta?.communityName && meta.communityName.trim().length > 0) {
                  whereParts.push(`the "${meta.communityName.trim()}" community`);
                } else {
                  whereParts.push('a community');
                }
              }

              const whereLabel =
                whereParts.length === 2 ? `${whereParts[0]} and ${whereParts[1]}` : whereParts[0];

              const action =
                n.category === 'question' ? 'posted a new question' : 'posted a new answer';

              displayMessage = `${n.actor} ${action} in ${whereLabel} you have bookmarked.`;
            }

            const eventDateValue = n.eventDate as unknown as Date | string;
            const targetTypeLabel = n.targetType ? n.targetType.toLowerCase() : 'activity';

            const priorityLabel = getEffectivePriority(n);

            return (
              <li key={key} className='notification-card' onClick={() => handleClick(n)}>
                <div className='notification-message'>{displayMessage}</div>
                <div className='notification-meta'>
                  <span className='notification-actor'>by {n.actor}</span>
                  <span className='notification-separator'>•</span>
                  <span className='notification-time'>{formatRelativeTime(eventDateValue)}</span>
                  <span className='notification-separator'>•</span>

                  <span className='notification-sources'>
                    {effectiveSources.map((src, srcIndex) => {
                      const slug = src.replace('/', '-');
                      return (
                        <span
                          key={`${key}-src-${src}-${srcIndex}`}
                          className={`notification-location badge-${slug}`}>
                          {formatLocationLabel(src)}
                        </span>
                      );
                    })}
                  </span>

                  <span className='notification-separator'>•</span>
                  <span
                    className={`notification-type badge-${(
                      n.targetType ?? 'activity'
                    ).toLowerCase()}`}>
                    {targetTypeLabel}
                  </span>

                  <span className='notification-separator'>•</span>
                  <span className={`notification-priority badge-priority-${priorityLabel}`}>
                    {priorityLabel}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPage;
