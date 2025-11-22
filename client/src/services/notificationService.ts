// FILE: client/src/services/notificationService.ts
import api from './config';
import type {
  NotificationItem,
  NotificationPreferencesDTO,
  NotificationDigestResponse,
} from '../types/types';

/**
 * Fetches the notification feed for a given username.
 */
const fetchNotificationFeed = async (username: string): Promise<NotificationItem[]> => {
  const response = await api.get<NotificationItem[]>(`/api/notification/feed/${username}`);
  return response.data;
};

/**
 * Fetches the digest of notifications for a given username.
 */
export const fetchNotificationDigest = async (
  username: string,
): Promise<NotificationDigestResponse> => {
  const response = await api.get<NotificationDigestResponse>(
    `/api/notification/digest/${encodeURIComponent(username)}`,
  );
  return response.data;
};

/**
 * Fetches notification preferences for a given username.
 */
export const fetchNotificationPreferences = async (
  username: string,
): Promise<NotificationPreferencesDTO> => {
  const response = await api.get<NotificationPreferencesDTO>(
    `/api/notification/preferences/${encodeURIComponent(username)}`,
  );
  return response.data;
};

/**
 * Updates notification preferences for a given username.
 */
export const updateNotificationPreferences = async (
  username: string,
  prefs: NotificationPreferencesDTO,
): Promise<NotificationPreferencesDTO> => {
  const response = await api.put<NotificationPreferencesDTO>(
    `/api/notification/preferences/${encodeURIComponent(username)}`,
    prefs,
  );
  return response.data;
};

export default fetchNotificationFeed;
