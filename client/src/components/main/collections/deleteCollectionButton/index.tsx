import './index.css';
import useDeleteCollectionButton from '../../../../hooks/useDeleteCollectionButton';

/**
 * This component renders a button that allows the user to delete a specific collection.
 */
const DeleteCollectionButton = ({ collectionId }: { collectionId: string }) => {
  const { handleDeleteCollection } = useDeleteCollectionButton();

  return (
    <div className='delete-collection-wrapper'>
      <button
        className='delete-collection-button'
        onClick={event => {
          event.stopPropagation();
          handleDeleteCollection(collectionId);
        }}>
        Delete Collection
      </button>
    </div>
  );
};

export default DeleteCollectionButton;
