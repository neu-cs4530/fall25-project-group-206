// client/src/components/NotificationSocketBridge.tsx
import { useEffect, useRef } from 'react';
import type { NotificationItem } from '../types/types';
import useUserContext from '../hooks/useUserContext';
import { useNotificationToast } from '../contexts/NotificationToastContext';
import fetchNotificationFeed from '../services/notificationService';

/**
 * Listens for server-side `notificationPing` events and, when the ping is for
 * the current user, fetches their notification feed and shows the most recent
 * notification as a popup toast.
 *
 * Behavior:
 *  - On mount (or when username changes), we fetch the current feed and store
 *    the latest eventDate as a "baseline" without showing a toast.
 *  - On each ping, we refetch and only show a toast if the latest notification
 *    has an eventDate strictly newer than that baseline.
 */
const NotificationSocketBridge = () => {
  const { user, socket } = useUserContext();
  const { pushNotification } = useNotificationToast();

  // Tracks the latest eventDate (in ms) we've already "acknowledged".
  // Anything <= this value will not trigger a toast.
  const lastSeenEventMsRef = useRef<number | null>(null);

  /**
   * Baseline load: when the user logs in or changes, set our "last seen"
   * timestamp to whatever the newest notification currently is, WITHOUT
   * showing any popup.
   */
  useEffect(() => {
    const loadBaseline = async () => {
      if (!user?.username) {
        lastSeenEventMsRef.current = null;
        return;
      }

      try {
        const feed = await fetchNotificationFeed(user.username);
        if (!feed || feed.length === 0) {
          lastSeenEventMsRef.current = null;
          return;
        }

        const sorted: NotificationItem[] = [...feed].sort(
          (a, b) =>
            new Date(b.eventDate as unknown as Date | string).getTime() -
            new Date(a.eventDate as unknown as Date | string).getTime(),
        );

        const latest = sorted[0];
        const eventDateValue = latest.eventDate as unknown as Date | string;
        const latestMs = new Date(eventDateValue).getTime();

        if (!Number.isNaN(latestMs)) {
          lastSeenEventMsRef.current = latestMs;
        } else {
          lastSeenEventMsRef.current = null;
        }
      } catch (err) {
        // If the baseline fetch fails, we leave lastSeenEventMsRef as null.
        lastSeenEventMsRef.current = null;
      }
    };

    void loadBaseline();
  }, [user?.username]);

  /**
   * Socket bridge: listen for `notificationPing`, but only show a toast if the
   * newest notification is strictly newer than our last seen timestamp.
   */
  useEffect(() => {
    if (!socket || !user?.username) {
      return;
    }

    const handlePing = async (payload: { username: string }) => {
      // Ignore pings for other users
      if (payload.username !== user.username) {
        return;
      }

      try {
        const feed = await fetchNotificationFeed(user.username);
        if (!feed || feed.length === 0) {
          return;
        }

        const sorted: NotificationItem[] = [...feed].sort(
          (a, b) =>
            new Date(b.eventDate as unknown as Date | string).getTime() -
            new Date(a.eventDate as unknown as Date | string).getTime(),
        );

        const latest = sorted[0];
        const eventDateValue = latest.eventDate as unknown as Date | string;
        const latestMs = new Date(eventDateValue).getTime();

        if (Number.isNaN(latestMs)) {
          // If eventDate is malformed, just treat it as "new once".
          pushNotification(latest);
          return;
        }

        const lastSeen = lastSeenEventMsRef.current;

        // Only show a toast if this notification is strictly newer than
        // anything we have already acknowledged.
        if (lastSeen !== null && latestMs <= lastSeen) {
          // No truly new notifications → do nothing.
          return;
        }

        // Update last seen and show the toast.
        lastSeenEventMsRef.current = latestMs;
        pushNotification(latest);
      } catch (err) {
        // Fallback: generic toast if something goes wrong.
        const fallback: NotificationItem = {
          actor: 'System',
          message: 'You have new notifications.',
          eventDate: new Date(),
          targetId: '' as unknown as NotificationItem['targetId'],
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
