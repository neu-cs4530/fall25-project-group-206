import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationContext } from '../../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import './index.css';

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAllRead } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setOpen(prev => !prev);
    if (!open) markAllRead();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className='notification-container' ref={dropdownRef}>
      <button className='notification-icon' onClick={toggleDropdown}>
        🔔
        {unreadCount > 0 && <span className='notification-badge'>{unreadCount}</span>}
      </button>

      {open && (
        <div className='notification-dropdown'>
          <h3>Notifications</h3>
          {notifications.length === 0 ? (
            <p className='empty'>No notifications yet.</p>
          ) : (
            <ul className='notification-list'>
              {notifications.slice(0, 8).map(n => (
                <li key={n._id} className={`notification-item ${n.isRead ? 'read' : 'unread'}`}>
                  <Link to={n.link || '#'} className='notification-link'>
                    <div className='notification-message'>{n.message}</div>
                    <div className='notification-time'>
                      {formatDistanceToNow(new Date(n.eventDate || n.createdAt || new Date()), {
                        addSuffix: true,
                      })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className='notification-footer'>
            <Link to='/notifications' onClick={() => setOpen(false)}>
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
