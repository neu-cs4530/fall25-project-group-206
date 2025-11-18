// client/src/hooks/useNotificationsPage.ts
import { useCallback, useEffect, useState } from 'react';
import { fetchNotificationFeed } from '../services/notificationService';
import type { NotificationItem } from '../types/types';
import useUserContext from './useUserContext';

const useNotificationsPage = () => {
  const { user } = useUserContext();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

      console.log('[useNotificationsPage] raw feed payload:', data);

      // Ensure newest → oldest by eventDate (server already does this, but safe)
      const sorted = [...data].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      );
      setNotifications(sorted);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    notifications,
    loading,
    error,
    refetch: load,
  };
};

export default useNotificationsPage;
