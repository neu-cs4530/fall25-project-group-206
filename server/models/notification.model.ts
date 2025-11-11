import mongoose from 'mongoose';
import notificationSchema from './schema/notification.schema';

/**
 * Mongoose model for the Notification collection.
 * Each document represents a notification sent to a user
 * regarding updates to their bookmarked entities or other events.
 * This model is used throughout the application to
 * create, retrieve, and update notifications.
 */
const NotificationModel = mongoose.model('Notification', notificationSchema);
export default NotificationModel;
