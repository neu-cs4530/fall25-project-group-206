// FILE: client/src/components/main/notificationsPage/index.tsx
import './index.css';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import useNotificationsPage from '../../../hooks/useNotificationsPage';
import NotificationPreferencesPanel from './NotificationPreferencesPanel';
import type { NotificationItem, NotificationPriority } from '../../../types/types';

/**
 * Normalize undefined priority to 'normal' for filtering.
 */
const getEffectivePriority = (item: NotificationItem): NotificationPriority =>
  item.priority ?? 'normal';

const NotificationsPage = () => {
  const { notifications, loading, error, refetch } = useNotificationsPage();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'feed' | 'preferences'>('feed');
  const [priorityFilter, setPriorityFilter] = useState<'highOnly' | 'normalPlusHigh' | 'all'>(
    'all',
  );

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

  if (viewMode === 'preferences') {
    return <NotificationPreferencesPanel onClose={() => setViewMode('feed')} />;
  }

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
              High only
            </button>
            <button
              type='button'
              className={
                priorityFilter === 'normalPlusHigh'
                  ? 'notifications-filter active'
                  : 'notifications-filter'
              }
              onClick={() => setPriorityFilter('normalPlusHigh')}>
              Normal + High
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
              const whereParts: string[] = [];
              if (hasCollectionSource) whereParts.push('a collection');
              if (hasCommunitySource) whereParts.push('a community');

              const whereLabel =
                whereParts.length === 2 ? 'a collection and a community' : whereParts[0];

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
