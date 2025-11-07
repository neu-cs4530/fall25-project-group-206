import QuestionView from '../../questionPage/question';
import useCollectionPage from '../../../../hooks/useCollectionPage';
import './index.css';
import DeleteCollectionButton from '../deleteCollectionButton';
import useBookmarkToggle from '../../../../hooks/useBookmarkToggle';
import { Star, StarOff } from 'lucide-react';

/**
 * Displays a single collection page with its metadata, description,
 * and list of associated questions.
 */
const CollectionPage = () => {
  const { collection, isOwner } = useCollectionPage();

  // Integrate bookmark hook (for collections)
  const {
    isBookmarked,
    loading: bookmarkLoading,
    handleToggleBookmark,
  } = useBookmarkToggle(collection?._id?.toString() ?? '', 'Collection');

  if (!collection) {
    return <div className='loading'>Loading...</div>;
  }

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggleBookmark();
  };

  return (
    <div className='collection-page'>
      <div className='collection-header'>
        <div className='header-row'>
          <h1 className='collection-title'>{collection.name}</h1>

          <div className='header-controls'>
            {/* Bookmark button */}
            <button
              className='bookmark-icon-btn'
              onClick={handleBookmarkClick}
              disabled={bookmarkLoading}
              title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}>
              {isBookmarked ? (
                <StarOff size={20} color='#facc15' fill='#facc15' strokeWidth={2} />
              ) : (
                <Star size={20} color='#9ca3af' strokeWidth={2} />
              )}
            </button>

            {/* Delete button (only for owner) */}
            {isOwner && <DeleteCollectionButton collectionId={collection._id.toString()} />}
          </div>
        </div>

        <p className='collection-description'>{collection.description}</p>
        <p className='collection-meta'>
          {collection.isPrivate ? 'Private' : 'Public'} • by {collection.username}
        </p>
      </div>

      <div className='questions-list'>
        {collection.questions.map(q => (
          <QuestionView question={q} key={q._id.toString()} />
        ))}
      </div>
    </div>
  );
};

export default CollectionPage;
