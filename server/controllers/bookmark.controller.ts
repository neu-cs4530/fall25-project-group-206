import express, { Response } from 'express';
import { ToggleBookmarkRequest, GetBookmarksByUserRequest, FakeSOSocket } from '../types/types';
import { toggleBookmark, getBookmarksByUsername } from '../services/bookmark.service';

/**
 * Controller for handling bookmark-related routes.
 * - Add or remove bookmarks
 * - Retrieve bookmarks by username
 */
const bookmarkController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * POST /api/bookmark/toggle
   * Toggles a bookmark for a user on a specific target.
   * Request Body:
   * - username: string
   * - targetId: string
   * - targetType: 'Collection' | 'Community' | 'User'
   * Responses:
   * - 200: The updated bookmark state
   * - 400: Invalid request body
   * - 500: Error toggling bookmark
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

      // Emit bookmark update to connected clients
      socket.emit('bookmarkUpdate', {
        type: 'toggled',
        bookmark: result,
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).send(`Error toggling bookmark: ${(error as Error).message}`);
    }
  });

  /**
   * GET /api/bookmark/getByUsername/:username
   * Retrieves all bookmarks for a specific user, optionally filtered by target type.
   * Query Parameters:
   * - targetType (optional): 'Collection' | 'Community' | 'User'
   * Responses:
   * - 200: Array of populated bookmarks
   * - 400: Missing username in request
   * - 500: Error retrieving bookmarks
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
