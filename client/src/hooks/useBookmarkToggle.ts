import { useEffect, useState } from 'react';
import { toggleBookmark, getBookmarksByUsername } from '../services/bookmarkService';
import useUserContext from './useUserContext';

/**
 * Custom hook to manage bookmark toggling for various target types.
 * @param targetId - The ID of the target to bookmark/unbookmark.
 * @param targetType - The type of the target (e.g., 'Question', 'Answer', 'Collection', 'Community', 'User').
 * @returns isBookmarked - Boolean indicating if the target is currently bookmarked.
 * @returns loading - Boolean indicating if the toggle operation is in progress.
 * @returns handleToggleBookmark - Function to toggle the bookmark state.
 **/

const useBookmarkToggle = (
  targetId: string,
  targetType: 'Question' | 'Answer' | 'Collection' | 'Community' | 'User',
) => {
  const { user } = useUserContext();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  // On mount, check if this item is already bookmarked
  useEffect(() => {
    const fetchInitialState = async () => {
      if (!user?.username) return;

      try {
        const bookmarks = await getBookmarksByUsername(
          user.username,
          targetType as 'Collection' | 'Community' | 'User',
        );

        const alreadyBookmarked = bookmarks.some(b => b.targetId?.toString() === targetId);

        setIsBookmarked(alreadyBookmarked);
      } catch (error) {
        // ignored, non-critical error
      }
    };

    fetchInitialState();
  }, [user?.username, targetId, targetType]);

  /**
   * Toggles a bookmark for the current user on a specific target.
   * - If the user is not logged in, the function exits early.
   * - Sends a request to add or remove the bookmark depending on its current state.
   * - Updates the local state and loading status accordingly.
   *
   * @returns {Promise<void>} - Resolves when the toggle operation completes.
   **/

  const handleToggleBookmark = async () => {
    if (!user?.username) return;

    try {
      setLoading(true);
      await toggleBookmark(
        user.username,
        targetId,
        targetType as 'Collection' | 'Community' | 'User',
      );
      setIsBookmarked(prev => !prev);
    } finally {
      setLoading(false);
    }
  };

  return { isBookmarked, loading, handleToggleBookmark };
};

export default useBookmarkToggle;
