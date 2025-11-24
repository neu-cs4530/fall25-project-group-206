import './index.css';
import useAllCollectionsPage from '../../../../hooks/useAllCollectionsPage';
import DeleteCollectionButton from '../deleteCollectionButton';
import BookmarkButton from '../../bookmarkButton';

/**
 * AllCollectionsPage component displays a list of collections for a specific user.
 */
const AllCollectionsPage = () => {
  const {
    usernameBeingViewed,
    collections,
    handleCreateCollection,
    handleViewCollection,
    isOwner,
  } = useAllCollectionsPage();

  return (
    <div className='collections-page'>
      <div className='collections-header'>
        <h1 className='collections-title'>{usernameBeingViewed}'s Collections</h1>
        {isOwner && (
          <button className='collections-create-btn' onClick={handleCreateCollection}>
            Create Collection
          </button>
        )}
      </div>

      <div className='collections-list'>
        {collections.map(collection => (
          <div
            key={collection._id.toString()}
            className='collection-card'
            onClick={() => handleViewCollection(collection._id.toString())}>
            <div className='collection-card-header'>
              <h2 className='collection-name'>{collection.name}</h2>
              <BookmarkButton targetId={collection._id.toString()} targetType='Collection' />
            </div>
            <p className='collection-description'>{collection.description}</p>

            <p className='collection-privacy'>{collection.isPrivate ? 'Private' : 'Public'}</p>
            <p className='collection-questions'>Questions: {collection.questions.length}</p>
            {isOwner && <DeleteCollectionButton collectionId={collection._id.toString()} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AllCollectionsPage;
