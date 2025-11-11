/**
 * Notification item interface representing a user notification.
 * - `user`: The username of the user receiving the notification.
 * - `message`: The content of the notification message.
 * - `category`: The category of the notification (e.g., 'info', 'warning').
 * - `targetId`: (Optional) The ID of the target related to the notification.
 * - `targetType`: (Optional) The type of the target related to the notification.
 * - `isRead`: (Optional) Indicates if the notification has been read.
 * - `createdAt`: (Optional) The timestamp when the notification was created.
 * - `eventDate`: (Optional) The date of the event that triggered the notification.
 * - `link`: (Optional) A URL link associated with the notification.
 */
export interface NotificationItem {
  _id?: string;
  user: string;
  message: string;
  category: string;
  targetId?: string;
  targetType?: string;
  isRead?: boolean;
  createdAt?: string | Date;
  eventDate?: string | Date;
  link?: string;
}
