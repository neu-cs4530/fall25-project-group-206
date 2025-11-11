import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import useUserContext from '../hooks/useUserContext';
import type { Socket } from 'socket.io-client';
import type { NotificationItem } from '../../../shared/types/notification';

interface NotificationContextType {
  unreadCount: number;
  notifications: NotificationItem[];
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function useSafeUserContext() {
  try {
    return useUserContext() as { user?: { username?: string }; socket?: Socket } | null;
  } catch {
    console.warn('[NotificationProvider] User context not available yet');
    return null;
  }
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const userCtx = useSafeUserContext();

  const user = userCtx?.user;
  const socket = userCtx?.socket;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!socket || !user?.username) {
      console.log('[NotificationProvider] No socket/user — skipping setup');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const eventName = `new-notification-${user.username}`;
    console.log(`🔔 [NotificationProvider] Listening for ${eventName}`);

    const handleNewNotification = (notif: NotificationItem) => {
      console.log('🆕 [NotificationProvider] New notification received:', notif);
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    socket.on(eventName, handleNewNotification);

    return () => {
      socket.off(eventName, handleNewNotification);
    };
  }, [socket, user?.username]);

  const markAllRead = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider');
  return ctx;
};
