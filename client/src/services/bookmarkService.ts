import axios from 'axios';
import { PopulatedDatabaseBookmark } from '@fake-stack-overflow/shared';

const BOOKMARK_API_URL = '/api/bookmark';

/**
 * Toggles a bookmark on or off.
 * @param username - The username of the user.
 * @param targetId - The ID of the target to bookmark/unbookmark.
 * @param targetType - The type of the target (e.g., 'Collection', 'Community', 'User').
 * @returns The updated bookmark state.
 */
export const toggleBookmark = async (
  username: string,
  targetId: string,
  targetType: 'Collection' | 'Community' | 'User',
) => {
  const res = await axios.post(`${BOOKMARK_API_URL}/toggle`, {
    username,
    targetId,
    targetType,
  });

  if (res.status !== 200) {
    throw new Error('Error toggling bookmark');
  }

  return res.data;
};

/**
 * Fetches bookmarks for a specific user, optionally filtered by target type.
 * @param username - The username of the user.
 * @param targetType - (Optional) The type of the target to filter bookmarks.
 * @returns An array of populated bookmarks.
 */
export const getBookmarksByUsername = async (
  username: string,
  targetType?: 'Collection' | 'Community' | 'User',
) => {
  const query = targetType ? `?targetType=${targetType}` : '';
  const res = await axios.get(`${BOOKMARK_API_URL}/getByUsername/${username}${query}`);

  if (res.status !== 200) {
    throw new Error('Error fetching bookmarks');
  }

  return res.data as PopulatedDatabaseBookmark[];
};
