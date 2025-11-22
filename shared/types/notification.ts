// client/src/types/types.d.ts
import { ObjectId } from 'mongodb';

export type NotificationLocation =
  | 'collection'
  | 'community'
  | 'collection/community'
  | 'following'
  | 'direct';

export type NotificationTargetType = 'Question' | 'Answer' | 'User';

export type NotificationPriority = 'low' | 'normal' | 'high';

export interface NotificationDigestMeta {
  collectionName?: string;
  communityName?: string;
}

export interface NotificationItem {
  _id?: ObjectId;
  actor: string;
  message: string;
  eventDate: Date;
  targetId: ObjectId;
  targetType: NotificationTargetType;
  location: NotificationLocation;
  link?: string;
  sources?: NotificationLocation[];
  category?: 'backfill' | 'question' | 'answer' | 'follow' | 'direct';
  priority?: NotificationPriority;
  digestMeta?: NotificationDigestMeta;
}

export interface DatabaseNotification extends Omit<NotificationItem, '_id'> {
  _id: ObjectId;
  user: string;
  isRead: boolean;
}

/**
 * Client-side DTO for notification preferences.
 * Matches the server's NotificationPreferencesDTO shape.
 */
export interface NotificationPreferencesDTO {
  mutedUsers: string[];
  mutedCommunities: string[]; // ids as strings
  mutedCollections: string[]; // ids as strings
  perCategoryLocation: Record<string, NotificationPriority>;
  perCategory: Record<string, NotificationPriority>;
  perLocation: Record<string, NotificationPriority>;
  defaultPriority: NotificationPriority;

  // NEW: global Do Not Disturb and optional daily quiet hours
  dndEnabled?: boolean;
  silentHours?: {
    start: string; // 'HH:MM' 24h (server time for now)
    end: string; // 'HH:MM'
  } | null;

  muteHighGroups?: boolean;
  muteNormalGroups?: boolean;
  muteLowGroups?: boolean;
}

export type DigestPriority = NotificationPriority | 'muted';

export interface NotificationDigestItem {
  id: string;
  priority: DigestPriority;
  category?: NotificationItem['category'];
  location: NotificationLocation;
  count: number;
  label: string;
  notifications: NotificationItem[];
}

export interface NotificationDigestResponse {
  high: NotificationDigestItem[];
  normal: NotificationDigestItem[];
  low: NotificationDigestItem[];
  muted: NotificationDigestItem[];
}
