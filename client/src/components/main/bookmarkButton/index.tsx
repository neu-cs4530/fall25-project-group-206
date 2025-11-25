// client/src/components/main/bookmarkButton/index.tsx
import './index.css';
import { MouseEvent } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import useBookmarkToggle, { ToggleResult } from '../../../hooks/useBookmarkToggle';

interface BookmarkButtonProps {
  targetId: string;
  targetType: 'Question' | 'Answer' | 'Collection' | 'Community' | 'User';

  /** If true, ask the user to confirm before removing an existing bookmark. */
  confirmOnRemove?: boolean;
  /** Optional custom confirmation message. */
  confirmMessage?: string;

  /** Optional callback fired after the toggle finishes. */
  onToggleComplete?: (result: ToggleResult) => void;
}

/**
 * BookmarkButton component allows users to toggle bookmarks on various entities.
 * - Displays current bookmark state and handles user interactions.
 */
const BookmarkButton = ({
  targetId,
  targetType,
  confirmOnRemove = false,
  confirmMessage = 'Remove this from your bookmarks?',
  onToggleComplete,
}: BookmarkButtonProps) => {
  const { isBookmarked, loading, handleToggleBookmark } = useBookmarkToggle(targetId, targetType);

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    // Prevent parent cards with onClick from firing.
    e.stopPropagation();

    if (confirmOnRemove && isBookmarked) {
      const ok = window.confirm(confirmMessage);
      if (!ok) {
        return;
      }
    }

    const result = await handleToggleBookmark();

    if (onToggleComplete) {
      onToggleComplete(result);
    }
  };

  return (
    <button
      className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
      onClick={handleClick}
      disabled={loading}
      aria-pressed={isBookmarked}>
      {isBookmarked ? (
        <>
          <BookmarkCheck className='bookmark-btn-icon' size={16} />
          <span>Saved</span>
        </>
      ) : (
        <>
          <Bookmark className='bookmark-btn-icon' size={16} />
          <span>Save</span>
        </>
      )}
    </button>
  );
};

export default BookmarkButton;
