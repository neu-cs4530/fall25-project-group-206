import './index.css';
import { useNavigate } from 'react-router-dom';
import useNotificationsPage from '../../../hooks/useNotificationsPage';
import type { NotificationItem } from '../../../types/types';

const NotificationsPage = () => {
  const { notifications, loading, error, refetch } = useNotificationsPage();
  const navigate = useNavigate();

  const handleClick = (notification: NotificationItem) => {
    if (notification.link) {
      navigate(notification.link);
      return;
    }

    navigate(`/question/${notification.targetId}`);
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

  // Helper to build a unique, stable key for each notification
  const makeKey = (n: NotificationItem, index: number): string => {
    if (n._id) {
      return String(n._id);
    }

    const targetIdStr =
      typeof n.targetId === 'string'
        ? n.targetId
        : ((n.targetId as any)?.toString?.() ?? 'unknownTarget');

    const eventTime = new Date(n.eventDate).getTime();

    return [
      'notif',
      targetIdStr,
      n.targetType,
      n.actor,
      eventTime || 'noTime',
      index, // final guardrail to avoid collisions
    ].join(':');
  };

  if (loading) {
    return <div className='notifications-page'>Loading notifications...</div>;
  }

  if (error) {
    return (
      <div className='notifications-page'>
        <div className='notifications-error'>
          <span>Failed to load notifications: {error}</span>
          <button type='button' onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!notifications.length) {
    return (
      <div className='notifications-page'>
        <h2>Notifications</h2>
        <p className='notifications-empty'>
          You do not have any notifications yet. Bookmark collections or communities to see activity
          here.
        </p>
      </div>
    );
  }

  return (
    <div className='notifications-page'>
      <div className='notifications-header'>
        <h2>Notifications</h2>
        <button type='button' className='notifications-refresh' onClick={refetch}>
          Refresh
        </button>
      </div>

      <ul className='notifications-list'>
        {notifications.map((n, index) => {
          const key = makeKey(n, index);

          const rawLocation = (n as any).location as string | undefined;
          const locationSlug = rawLocation?.replace('/', '-') ?? 'unknown';
          const locationLabel = rawLocation ?? 'feed';

          const rawTargetType = (n as any).targetType as string | undefined;
          const targetTypeLabel = rawTargetType ?? 'Activity';
          const targetTypeSlug = rawTargetType?.toLowerCase() ?? 'activity';

          return (
            <li key={key} className='notification-card' onClick={() => handleClick(n)}>
              <div className='notification-message'>{n.message}</div>
              <div className='notification-meta'>
                <span className='notification-actor'>by {n.actor}</span>
                <span className='notification-separator'>•</span>
                <span className='notification-time'>
                  {formatRelativeTime((n as any).eventDate)}
                </span>
                <span className='notification-separator'>•</span>
                <span className={`notification-location badge-${locationSlug}`}>
                  {locationLabel}
                </span>
                <span className='notification-separator'>•</span>
                <span className={`notification-type badge-${targetTypeSlug}`}>
                  {targetTypeLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default NotificationsPage;
