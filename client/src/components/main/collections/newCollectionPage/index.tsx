import './index.css';
import useNewCollectionPage from '../../../../hooks/useNewCollectionPage';

/**
 * This component renders a form for creating a new collection.
 */
const NewCollectionPage = () => {
  const {
    error,
    collectionName,
    collectionDescription,
    isPrivate,
    handleCollectionNameChange,
    handleCollectionDescriptionChange,
    handleIsPrivateChange,
    handleCreateCollection,
  } = useNewCollectionPage();

  return (
    <div className='new-collection-page'>
      <h1 className='new-collection-title'>Create New Collection</h1>

      <input
        type='text'
        placeholder='Collection Name'
        className='new-collection-input'
        onChange={handleCollectionNameChange}
        value={collectionName}
      />

      <input
        type='text'
        placeholder='Collection Description'
        className='new-collection-input'
        value={collectionDescription}
        onChange={handleCollectionDescriptionChange}
      />

      <label className='new-collection-checkbox'>
        <input type='checkbox' checked={isPrivate} onChange={handleIsPrivateChange} />
        Private Collection
      </label>

      <button className='new-collection-btn' onClick={handleCreateCollection}>
        Create
      </button>

      {error && <p className='new-collection-error'>{error}</p>}
    </div>
  );
};

export default NewCollectionPage;
