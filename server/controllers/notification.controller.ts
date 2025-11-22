// FILE: server/controllers/notification.controller.ts
import express, { Request, Response } from 'express';
import { FakeSOSocket } from '../types/types';
import {
  buildNotificationFeedForUser,
  buildNotificationDigestForUser,
} from '../services/notificationFeed.service';
import {
  getPreferencesDTO,
  updatePreferencesForUser,
  type NotificationPreferencesUpdate,
} from '../services/notificationPreferences.service';

const notificationController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * GET /api/notification/feed/:username
   *
   * Builds a notification feed for the given user.
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

        res.status(200).json(result);
      } catch (error) {
        res.status(500).send(`Error building notification feed: ${(error as Error).message}`);
      }
    },
  );

  /**
   * GET /api/notification/preferences/:username
   *
   * Returns the user's notification preferences in DTO form.
   */
  router.get(
    '/preferences/:username',
    async (req: Request<{ username: string }>, res: Response): Promise<void> => {
      const { username } = req.params;

      if (!username) {
        res.status(400).send('Missing username in request.');
        return;
      }

      try {
        const prefs = await getPreferencesDTO(username);
        res.status(200).json(prefs);
      } catch (error) {
        res
          .status(500)
          .send(`Error fetching notification preferences: ${(error as Error).message}`);
      }
    },
  );

  /**
   * GET /api/notification/digest/:username
   *
   * Builds a digest of notifications for the given user, grouped by
   * priority (high/normal/low/muted), category, and location.
   */
  router.get(
    '/digest/:username',
    async (req: Request<{ username: string }>, res: Response): Promise<void> => {
      const { username } = req.params;

      if (!username) {
        res.status(400).send('Missing username in request.');
        return;
      }

      try {
        const result = await buildNotificationDigestForUser(username);

        if ('error' in result) {
          throw new Error(result.error);
        }

        res.status(200).json(result);
      } catch (error) {
        res.status(500).send(`Error building notification digest: ${(error as Error).message}`);
      }
    },
  );

  /**
   * PUT /api/notification/preferences/:username
   *
   * Replaces the user's notification preferences with the payload.
   */
  router.put(
    '/preferences/:username',
    async (
      req: Request<{ username: string }, unknown, NotificationPreferencesUpdate>,
      res: Response,
    ): Promise<void> => {
      const { username } = req.params;

      if (!username) {
        res.status(400).send('Missing username in request.');
        return;
      }

      try {
        const updated = await updatePreferencesForUser(username, req.body);
        res.status(200).json(updated);
      } catch (error) {
        res
          .status(500)
          .send(`Error updating notification preferences: ${(error as Error).message}`);
      }
    },
  );

  return router;
};

export default notificationController;
