// server/services/notification.service.ts
import { EventEmitter } from 'events';
import NotificationModel from '../models/notification.model';
import { ioInstance } from '../app';

const eventBus = new EventEmitter();

/**
 * Generic notification creation handler.
 * Any feature can emit:
 * eventBus.emit("notification.create", {
 *   user: "matth",
 *   message: "New follower: @gary",
 *   category: "social",
 *   targetId: "12345",
 *   targetType: "User"
 * });
 */
eventBus.on('notification.create', async payload => {
  try {
    const { user, message, category = 'system', targetId, targetType } = payload;

    const notification = await NotificationModel.create({
      user,
      message,
      category,
      targetId,
      targetType,
    });

    // Emit a live socket event to that user’s channel
    ioInstance.emit(`new-notification-${user}`, notification);
  } catch (err) {
    // purposeful do nothing
  }
});

export default eventBus;
