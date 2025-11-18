// client/src/contexts/NotificationToastContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import type { NotificationItem } from '../types/types';

interface NotificationToastContextValue {
  activeNotification: NotificationItem | null;
  pushNotification: (notification: NotificationItem) => void;
  clearNotification: () => void;
}

const NotificationToastContext = createContext<NotificationToastContextValue | undefined>(
  undefined,
);

export const NotificationToastProvider = ({ children }: { children: ReactNode }) => {
  const [activeNotification, setActiveNotification] = useState<NotificationItem | null>(null);

  const pushNotification = (notification: NotificationItem) => {
    setActiveNotification(notification);
  };

  const clearNotification = () => {
    setActiveNotification(null);
  };

  return (
    <NotificationToastContext.Provider
      value={{
        activeNotification,
        pushNotification,
        clearNotification,
      }}>
      {children}
    </NotificationToastContext.Provider>
  );
};

export const useNotificationToast = (): NotificationToastContextValue => {
  const ctx = useContext(NotificationToastContext);
  if (!ctx) {
    throw new Error('useNotificationToast must be used within a NotificationToastProvider');
  }
  return ctx;
};
