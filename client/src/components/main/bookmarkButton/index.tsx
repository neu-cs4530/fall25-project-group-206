import './index.css';
import useBookmarkToggle from '../../../hooks/useBookmarkToggle';

interface BookmarkButtonProps {
  targetId: string;
  targetType: 'Question' | 'Answer' | 'Collection' | 'Community' | 'User';
}

/**
 * BookmarkButton component allows users to toggle bookmarks on various entities.
 * - Displays current bookmark state and handles user interactions.
 * @param targetId - The ID of the target entity to bookmark/unbookmark.
 * @param targetType - The type of the target entity (e.g., 'Question', 'Answer', 'Collection', 'Community', 'User').
 * @returns A button element for toggling bookmarks.
 */
const BookmarkButton = ({ targetId, targetType }: BookmarkButtonProps) => {
  const { isBookmarked, loading, handleToggleBookmark } = useBookmarkToggle(targetId, targetType);

  return (
    <button
      className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
      onClick={handleToggleBookmark}
      disabled={loading}>
      {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
    </button>
  );
};

export default BookmarkButton;
