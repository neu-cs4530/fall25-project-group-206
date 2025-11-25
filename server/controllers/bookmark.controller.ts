// server/controllers/bookmark.controller.ts
import express, { Response } from 'express';
import { FakeSOSocket, ToggleBookmarkRequest, GetBookmarksByUserRequest } from '../types/types';
import { toggleBookmark, getBookmarksByUsername } from '../services/bookmark.service';
import { DatabaseBookmark } from '@fake-stack-overflow/shared';

const bookmarkController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * POST /api/bookmark/toggle
   * Toggles a bookmark for a user on a specific target.
   */
  router.post('/toggle', async (req: ToggleBookmarkRequest, res: Response): Promise<void> => {
    try {
      const { username, targetId, targetType } = req.body;

      if (!username || !targetId || !targetType) {
        res.status(400).send('Invalid bookmark request body.');
        return;
      }

      const result = await toggleBookmark(username, targetId, targetType);

      if ('error' in result) {
        throw new Error(result.error);
      }

      // Case 1: bookmark was removed → must match { removed: boolean } schema
      if ('removed' in result) {
        const payload = { removed: Boolean(result.removed) };

        socket.emit('bookmarkUpdate', {
          type: 'toggled',
          bookmark: payload,
        });

        res.status(200).json(payload);
        return;
      }

      // Case 2: bookmark was created → must match DatabaseBookmark schema
      // At this point `result` is narrowed to DatabaseBookmark by TS
      const bookmark: DatabaseBookmark = {
        _id: result._id,
        username: result.username,
        targetId: result.targetId,
        targetType: result.targetType,
        createdAt: result.createdAt,
      };

      socket.emit('bookmarkUpdate', {
        type: 'toggled',
        bookmark: bookmark,
      });

      res.status(200).json(bookmark);
    } catch (error) {
      res.status(500).send(`Error toggling bookmark: ${(error as Error).message}`);
    }
  });

  /**
   * GET /api/bookmark/getByUsername/:username
   */
  router.get(
    '/getByUsername/:username',
    async (req: GetBookmarksByUserRequest, res: Response): Promise<void> => {
      try {
        const { username } = req.params;
        const { targetType } = req.query;

        if (!username) {
          res.status(400).send('Missing username in request.');
          return;
        }

        const bookmarks = await getBookmarksByUsername(
          username,
          targetType as 'Collection' | 'Community' | 'User',
        );

        if ('error' in bookmarks) {
          throw new Error(bookmarks.error);
        }

        res.status(200).json(bookmarks);
      } catch (error) {
        res.status(500).send(`Error retrieving bookmarks: ${(error as Error).message}`);
      }
    },
  );

  return router;
};

export default bookmarkController;
