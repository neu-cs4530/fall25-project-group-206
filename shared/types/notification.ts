// shared/types/notification.ts
import { ObjectId } from 'mongodb';

/**
 * Where this activity happened, from the perspective of the current user.
 * - 'collection'           → only in a bookmarked collection
 * - 'community'            → only in a bookmarked community
 * - 'collection/community' → appears in both a bookmarked collection and community
 */
export type NotificationLocation = 'collection' | 'community' | 'collection/community';

/**
 * What kind of thing this notification is about.
 */
export type NotificationTargetType = 'Question' | 'Answer';

/**
 * Backfill / inbox notification item.
 *
 * This is intentionally “frontend-ready”:
 *  - has a message string you can render directly
 *  - has eventDate for sorting / display (“3 hours ago”)
 *  - has enough metadata to link to the target (question page etc.)
 */
export interface NotificationItem {
  /**
   * Optional DB id if you later persist notifications.
   * For pure backfill, this will usually be undefined.
   */
  _id?: ObjectId;

  /**
   * Who did the action? (asked / answered)
   * Example: "user123"
   */
  actor: string;

  /**
   * Human-readable description.
   * Example: 'user123 posted an answer to "How to do this" in your community'
   */
  message: string;

  /**
   * When this event actually happened (askDateTime for questions, ansDateTime for answers).
   */
  eventDate: Date;

  /**
   * The underlying target id (usually the Question _id).
   * Even for answer notifications we can link to the question page.
   */
  targetId: ObjectId;

  /**
   * Whether this represents a new Question or an Answer.
   */
  targetType: NotificationTargetType;

  /**
   * Where the user has this item (collection vs community vs both).
   */
  location: NotificationLocation;

  /**
   * Optional: direct link path the frontend can use.
   * Example: `/questions/64f...` or `/collections/username/collectionId`
   */
  link?: string;

  /**
   * Used to distinguish backfilled entries vs future real-time notifications.
   */
  category?: 'backfill' | 'question' | 'answer';
}

/**
 * Database-persisted notification.
 *
 * This extends the “view model” NotificationItem with:
 *  - `user`: the recipient (username)
 *  - `_id`: always present once saved
 *  - `isRead`: read/unread state
 */
export interface DatabaseNotification extends Omit<NotificationItem, '_id'> {
  _id: ObjectId;

  /**
   * Username of the notification recipient.
   */
  user: string;

  /**
   * Whether this notification has been read.
   */
  isRead: boolean;
}
