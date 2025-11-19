// server/controllers/notification.controller.ts
import express, { Request, Response } from 'express';
import { FakeSOSocket } from '../types/types';
import { buildNotificationFeedForUser } from '../services/notificationFeed.service';

const notificationController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * GET /api/notification/feed/:username
   *
   * Builds a notification feed for the given user.
   * Currently:
   *  - Uses bookmark-based backfill only.
   * Future:
   *  - Will merge additional sources (followers, chat, etc.).
   */
  router.get(
    '/feed/:username',
    async (req: Request<{ username: string }>, res: Response): Promise<void> => {
      const { username } = req.params;

      if (!username) {
        res.status(400).send('Missing username in request.');
        return;
      }

      try {
        const result = await buildNotificationFeedForUser(username);

        if ('error' in result) {
          throw new Error(result.error);
        }

        console.log(
          '[notificationController] feed for',
          username,
          ':',
          JSON.stringify(result, null, 2),
        );

        res.status(200).json(result);
      } catch (error) {
        res.status(500).send(`Error building notification feed: ${(error as Error).message}`);
      }
    },
  );

  return router;
};

export default notificationController;
