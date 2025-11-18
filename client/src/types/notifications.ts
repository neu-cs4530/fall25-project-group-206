// client/src/types/notification.ts
export type NotificationLocation = 'collection' | 'community' | 'collection/community';

export type NotificationTargetType = 'Question' | 'Answer';

export type NotificationCategory = 'backfill' | 'question' | 'answer';

/**
 * Client-side view of a notification.
 *
 * Note:
 *  - _id, targetId are strings (JSON from server)
 *  - eventDate is an ISO string
 */
export interface NotificationItem {
  _id?: string;
  actor: string;
  message: string;
  eventDate: string;
  targetId: string;
  targetType: NotificationTargetType;
  location: NotificationLocation;
  link?: string;
  category?: NotificationCategory;
}
