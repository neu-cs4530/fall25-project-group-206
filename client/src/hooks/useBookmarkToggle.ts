// client/src/hooks/useBookmarkToggle.ts
import { useEffect, useState } from 'react';
import { toggleBookmark, getBookmarksByUsername } from '../services/bookmarkService';
import useUserContext from './useUserContext';

export type ToggleResult = 'added' | 'removed' | 'noop';

/**
 * Custom hook to manage bookmark toggling for a given target item.
 * @param targetId The ID of the target item to toggle bookmark for
 * @param targetType The type of the target item
 * @returns An object containing bookmark state, loading state, and a toggle function
 */
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

      // Only these types are actually stored in Bookmark collection
      if (!['Collection', 'Community', 'User'].includes(targetType)) {
        return;
      }

      try {
        const bookmarks = await getBookmarksByUsername(
          user.username,
          targetType as 'Collection' | 'Community' | 'User',
        );

        const alreadyBookmarked = bookmarks.some(b => b.targetId?.toString() === targetId);
        setIsBookmarked(alreadyBookmarked);
      } catch {
        // non-critical, ignore
      }
    };

    fetchInitialState();
  }, [user?.username, targetId, targetType]);

  /**
   * Toggles the bookmark state for the target item.
   * @returns A promise that resolves to the result of the toggle action ('added', 'removed', or 'noop')
   */
  const handleToggleBookmark = async (): Promise<ToggleResult> => {
    if (!user?.username) return 'noop';

    // Guard against unsupported types for the backend
    if (!['Collection', 'Community', 'User'].includes(targetType)) {
      return 'noop';
    }

    try {
      setLoading(true);

      const result = await toggleBookmark(
        user.username,
        targetId,
        targetType as 'Collection' | 'Community' | 'User',
      );

      // Server-side unbookmark
      if (result && typeof result === 'object' && 'removed' in result && result.removed) {
        setIsBookmarked(false);
        return 'removed';
      }

      // Otherwise, we treat it as successfully added
      setIsBookmarked(true);
      return 'added';
    } catch {
      // On error, do not change local state
      return 'noop';
    } finally {
      setLoading(false);
    }
  };

  return { isBookmarked, loading, handleToggleBookmark };
};

export default useBookmarkToggle;
