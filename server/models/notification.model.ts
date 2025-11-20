// server/models/notification.model.ts
import mongoose, { Model } from 'mongoose';
import notificationSchema from './schema/notification.schema';
import { DatabaseNotification } from '@fake-stack-overflow/shared';

/**
 * Mongoose model for the Notification collection.
 *
 * Each document represents a single notification delivered to a specific user.
 * The schema enforces:
 *  - recipient user
 *  - actor
 *  - message
 *  - event date
 *  - target id/type
 *  - location (collection/community/both)
 *  - category (backfill/question/answer)
 *  - read/unread state
 */
const NotificationModel: Model<DatabaseNotification> = mongoose.model<DatabaseNotification>(
  'Notification',
  notificationSchema,
);

export default NotificationModel;
