import { useEffect, useState, useCallback } from 'react';
import api from '../services/config';
import useUserContext from './useUserContext';
import type { Socket } from 'socket.io-client';
import type { NotificationItem } from '../../../shared/types/notification';

/**
 * Custom hook to fetch and manage notifications for the notifications page.
 * Handles both initial load and live updates via Socket.IO.
 */
export default function useNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, socket } = useUserContext() as {
    user?: { username?: string };
    socket?: Socket;
  };

  /**
   * Fetches notifications for the current user.
   * Memoized to prevent re-creation on every render.
   */
  const fetchNotifications = useCallback(async (): Promise<void> => {
    console.log('📡 [useNotificationsPage] fetchNotifications() called');

    if (!user?.username) {
      console.log('⚠️ No username found — aborting fetch');
      return;
    }

    try {
      const url = `/api/notifications/${user.username}?t=${Date.now()}`;
      console.log(`➡️ Fetching ${url}`);
      const res = await api.get(url);
      const data = res.data;
      console.log('✅ Notifications API response received:', data);

      if (Array.isArray(data)) {
        console.log(`📋 Setting ${data.length} notifications (direct array)`);
        setNotifications(data);
      } else if (Array.isArray(data.notifications)) {
        console.log(`📋 Setting ${data.notifications.length} notifications (nested array)`);
        setNotifications(data.notifications);
      } else {
        console.log('⚠️ Unexpected response shape, resetting to empty');
        setNotifications([]);
      }
    } catch (err) {
      console.error('❌ Error fetching notifications:', err);
      setNotifications([]);
    } finally {
      console.log('⏹️ Finished fetchNotifications()');
      setLoading(false);
    }
  }, [user?.username]);

  /**
   * Effect: load notifications + listen for live updates via socket.
   */
  useEffect(() => {
    console.log('🧭 [useNotificationsPage] useEffect() triggered');
    void fetchNotifications();

    if (!socket || !user?.username) {
      console.log('⚠️ No socket or username — skipping socket listener');
      return;
    }

    const eventName = `new-notification-${user.username}`;
    console.log(`🔌 Subscribing to socket event: ${eventName}`);

    const handleNewNotification = (notif: NotificationItem): void => {
      console.log('🆕 Received new notification via socket:', notif);
      setNotifications(prev => [notif, ...prev]);
    };

    socket.on(eventName, handleNewNotification);

    // Cleanup listener on unmount or dependency change
    return () => {
      console.log(`🔌 Unsubscribing from socket event: ${eventName}`);
      socket.off(eventName, handleNewNotification);
    };
  }, [fetchNotifications, socket, user?.username]);

  console.log('📦 Hook state -> notifications:', notifications.length, '| loading:', loading);

  /**
   * Expose the notifications list, loading state, and manual refresh handler.
   */
  return {
    notifications,
    loading,
    refresh: fetchNotifications,
  };
}
