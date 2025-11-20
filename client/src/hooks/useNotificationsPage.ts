// client/src/hooks/useNotificationsPage.ts
import { useCallback, useEffect, useState } from 'react';
import fetchNotificationFeed from '../services/notificationService';
import type { NotificationItem } from '../types/types';
import useUserContext from './useUserContext';

const useNotificationsPage = () => {
  const { user, socket } = useUserContext();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Optional: flag that something new arrived in real time
  const [hasNew, setHasNew] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!user?.username) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchNotificationFeed(user.username);

      // Ensure newest → oldest by eventDate
      const sorted = [...data].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      );

      setNotifications(sorted);
      setHasNew(false); // just synced with server
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  // Initial load + reload whenever the username changes
  useEffect(() => {
    load();
  }, [load]);

  // Socket registration + live reload on notificationPing
  useEffect(() => {
    if (!user?.username || !socket) {
      return;
    }

    // Inform server which user this socket represents (safe even if server ignores it for now)
    socket.emit('register-user', user.username);

    const handler = (payload: { username: string }) => {
      // If the server is broadcasting to everyone, we only react to our own username
      if (payload?.username && payload.username !== user.username) {
        return;
      }

      setHasNew(true);
      void load();
    };

    socket.on('notificationPing', handler);

    return () => {
      socket.off('notificationPing', handler);
    };
  }, [user?.username, socket, load]);

  return {
    notifications,
    loading,
    error,
    refetch: load,
    hasNew,
  };
};

export default useNotificationsPage;
