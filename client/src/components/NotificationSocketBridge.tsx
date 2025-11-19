// client/src/components/NotificationSocketBridge.tsx
import { useEffect } from 'react';
import type { FakeSOSocket } from '../types/types';
import useUserContext from '../hooks/useUserContext';
import { useNotificationToast } from '../contexts/NotificationToastContext';
import { fetchNotificationFeed } from '../services/notificationService';
import type { NotificationItem } from '../types/types';

interface NotificationSocketBridgeProps {
  socket: FakeSOSocket | null;
}

/**
 * Listens for server-side `notificationPing` events and, when the ping is for
 * the current user, fetches their notification feed and shows the most recent
 * notification as a popup toast.
 */
const NotificationSocketBridge = ({ socket }: NotificationSocketBridgeProps) => {
  const { user } = useUserContext();
  const { pushNotification } = useNotificationToast();

  useEffect(() => {
    if (!socket || !user?.username) {
      return;
    }

    const handlePing = async (payload: { username: string }) => {
      // Ignore pings for other users
      if (payload.username !== user.username) {
        return;
      }

      console.log('[NotificationSocketBridge] notificationPing for', payload.username);

      try {
        const feed = await fetchNotificationFeed(user.username);

        if (!feed || feed.length === 0) {
          return;
        }

        // Ensure newest → oldest by eventDate (extra safety)
        const sorted: NotificationItem[] = [...feed].sort(
          (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
        );

        const latest = sorted[0];
        console.log('[NotificationSocketBridge] latest notification for toast:', latest);

        // Push the latest notification into the toast system
        pushNotification(latest);
      } catch (err) {
        console.error('[NotificationSocketBridge] Failed to fetch notification feed:', err);

        // Fallback: simple generic toast if something goes wrong.
        const fallback: NotificationItem = {
          actor: 'System',
          message: 'You have new notifications.',
          eventDate: new Date(),
          targetId: '' as any, // dummy, not used by the toast
          targetType: 'Question',
          location: 'collection',
          link: '/notifications',
          category: 'backfill',
        };

        pushNotification(fallback);
      }
    };

    socket.on('notificationPing', handlePing);

    return () => {
      socket.off('notificationPing', handlePing);
    };
  }, [socket, user?.username, pushNotification]);

  return null;
};

export default NotificationSocketBridge;
