import express, { Response } from 'express';
import NotificationModel from '../models/notification.model';
import backfillUserNotifications from '../services/notificationBackfill.service';
import { FakeSOSocket } from '../types/types';
import type { NotificationItem } from '../../shared/types/notification';

const notificationController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * Helper: rebuild a user's notifications from scratch (bookmarks only)
   */
  const rebuildNotifications = async (username: string): Promise<NotificationItem[]> => {
    console.log(`\n=== 🔁 Rebuilding notifications for ${username} ===`);

    // 1️⃣ Start completely clean
    const deleteResult = await NotificationModel.deleteMany({ user: username });
    console.log(`🧹 Deleted ${deleteResult.deletedCount} existing notifications.`);

    // 2️⃣ Run the backfill (this recreates all current bookmark notifications)
    await backfillUserNotifications(username);

    // 3️⃣ Retrieve the newly created ones
    const refreshedDocs = await NotificationModel.find({
      user: username,
      category: 'bookmark_backfill',
    })
      .sort({ eventDate: -1 })
      .limit(100);

    // 4️⃣ Convert to plain NotificationItem[]
    const refreshed: NotificationItem[] = refreshedDocs.map(doc => ({
      _id: doc._id.toString(),
      user: doc.user,
      message: doc.message,
      category: doc.category,
      targetId: doc.targetId ? doc.targetId.toString() : undefined,
      targetType: doc.targetType ?? undefined,
      isRead: doc.isRead,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date(doc.createdAt).toISOString(),
      eventDate: doc.eventDate ? new Date(doc.eventDate).toISOString() : undefined,
      link: doc.link ?? undefined,
    }));

    console.log(`✅ Returning ${refreshed.length} rebuilt notifications for ${username}`);
    return refreshed;
  };

  /**
   * GET /api/notifications/:username
   * Fully rebuilds notifications each time (clean slate).
   */
  router.get('/:username', async (req, res: Response): Promise<void> => {
    try {
      const { username } = req.params;
      if (!username) {
        res.status(400).send('Missing username in request.');
        return;
      }

      const notifications = await rebuildNotifications(username);
      res.status(200).json(notifications);
    } catch (error) {
      console.error('Error rebuilding notifications:', error);
      res.status(500).send(`Error rebuilding notifications: ${(error as Error).message}`);
    }
  });

  /**
   * POST /api/notifications/:username/refresh
   * Manually triggers the same rebuild.
   */
  router.post('/:username/refresh', async (req, res: Response): Promise<void> => {
    try {
      const { username } = req.params;
      if (!username) {
        res.status(400).send('Missing username in request.');
        return;
      }

      const notifications = await rebuildNotifications(username);
      res.status(200).json(notifications);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      res.status(500).send(`Error refreshing notifications: ${(error as Error).message}`);
    }
  });

  return router;
};

export default notificationController;
