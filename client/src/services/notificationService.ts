// notificationService.ts
import api from './config';
import type { NotificationItem } from '../types/types';

/**
 * Fetches the notification feed for a given username.
 */
const fetchNotificationFeed = async (username: string): Promise<NotificationItem[]> => {
  const response = await api.get<NotificationItem[]>(`/api/notification/feed/${username}`);
  return response.data;
};

export default fetchNotificationFeed;
