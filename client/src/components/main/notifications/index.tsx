import './index.css';
import useNotificationsPage from '../../../hooks/useNotificationPage';
import { formatDistanceToNow } from 'date-fns';
import api from '../../../services/config';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NotificationsPage component renders the user's inbox for system updates and alerts.
 * The entire notification card is clickable if it contains a link.
 * Includes a refresh button to re-run bookmark_backfill via backend.
 */
const NotificationsPage = () => {
  const { notifications, loading, refresh } = useNotificationsPage();
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.username) return;

      // Call backend route to re-run backfill
      await api.post(`/api/notifications/${user.username}/refresh`);

      // Re-fetch notifications after refresh completes
      await refresh();
    } catch {
      // purposeful no-op
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className='notifications-page'>Loading notifications…</div>;
  }

  return (
    <div className='notifications-page'>
      <div className='notifications-header'>
        <h1 className='page-title'>Inbox / Notifications</h1>
        <button
          type='button'
          className='refresh-button'
          onClick={handleRefresh}
          disabled={refreshing}>
          {refreshing ? 'Refreshing…' : '↻ Refresh Feed'}
        </button>
      </div>

      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <ul className='notification-list'>
          {notifications.map(n => (
            <li
              key={n._id}
              className={`notification-item ${n.isRead ? 'read' : 'unread'}`}
              onClick={() => n.link && navigate(n.link)}
              style={{
                cursor: n.link ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
              }}>
              <div className='notification-message'>{n.message}</div>
              <div className='notification-meta'>
                <span className='notification-category'>{n.category}</span>
                <span className='notification-time'>
                  {formatDistanceToNow(new Date(n.eventDate || n.createdAt || new Date()), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPage;
