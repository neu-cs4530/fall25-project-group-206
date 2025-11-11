import { useEffect, useState } from 'react';
import { useNotificationContext } from '../../../contexts/NotificationContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import './index.css';

/**
 * Global floating dropdown panel for new notifications.
 * Appears from the top-center of the viewport.
 */
export default function NotificationOverlay() {
  const { notifications, unreadCount, markAllRead } = useNotificationContext();
  const [visible, setVisible] = useState(false);

  // Show overlay briefly when new notifications arrive
  useEffect(() => {
    if (unreadCount > 0) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  if (!visible) return null;

  return (
    <div className='notification-overlay'>
      <div className='notification-panel'>
        <h3>New Notifications</h3>
        <ul>
          {notifications.slice(0, 3).map(n => (
            <li key={n._id} className='notification-item'>
              <Link to={n.link || '#'} onClick={markAllRead}>
                <div className='message'>{n.message}</div>
                <div className='time'>
                  {formatDistanceToNow(new Date(n.eventDate || n.createdAt || new Date()), {
                    addSuffix: true,
                  })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <Link to='/notifications' className='view-all' onClick={markAllRead}>
          View all →
        </Link>
      </div>
    </div>
  );
}
