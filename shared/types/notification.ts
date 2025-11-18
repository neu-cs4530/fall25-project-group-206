import { ObjectId } from 'mongodb';

/**
 * Where this activity happened, from the perspective of the current user.
 * - 'collection'           → only in a bookmarked collection
 * - 'community'            → only in a bookmarked community
 * - 'collection/community' → appears in both a bookmarked collection and community
 * - 'following'            → activity from someone you follow
 */
export type NotificationLocation =
  | 'collection'
  | 'community'
  | 'collection/community'
  | 'following';

/**
 * What kind of thing this notification is about.
 */
export type NotificationTargetType = 'Question' | 'Answer' | 'User';

/**
 * Backfill / inbox notification item.
 */
export interface NotificationItem {
  _id?: ObjectId;

  actor: string;

  message: string;

  eventDate: Date;

  targetId: ObjectId;

  targetType: NotificationTargetType;

  location: NotificationLocation;

  link?: string;

  /**
   * Used to distinguish backfilled entries vs future real-time notifications.
   * - 'backfill' → bookmark-based backfill
   * - 'question' / 'answer' → live persisted Q/A events
   * - 'follow' → user-follow events
   */
  category?: 'backfill' | 'question' | 'answer' | 'follow';
}

/**
 * Database-persisted notification.
 */
export interface DatabaseNotification extends Omit<NotificationItem, '_id'> {
  _id: ObjectId;
  user: string;
  isRead: boolean;
}
