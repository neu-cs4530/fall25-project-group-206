import './index.css';
import { PopulatedDatabaseQuestion } from '../../../../types/types';
import useSaveToCollectionModal from '../../../../hooks/useSaveToCollectionModal';

/**
 * SaveToCollectionModal component allows users to save a question to their collections.
 * It fetches the user's collections and displays them with options to save or unsave the question.
 */
const SaveToCollectionModal = ({
  question,
  onClose,
}: {
  question: PopulatedDatabaseQuestion;
  onClose: () => void;
}) => {
  const { collections, handleToggleSave } = useSaveToCollectionModal(question);

  return (
    <div className='modal-backdrop' onClick={e => e.stopPropagation()}>
      <div className='modal-container' onClick={e => e.stopPropagation()}>
        <h2 className='modal-title'>Save to Collection</h2>
        <ul className='collection-list'>
          {collections.map(collection => {
            const isSaved = collection.questions.some(q => q._id === question._id);

            return (
              <li key={collection._id.toString()} className='collection-row'>
                <span className='collection-name'>{collection.name}</span>
                <span className={`status-tag ${isSaved ? 'saved' : 'unsaved'}`}>
                  {isSaved ? 'Saved' : 'Not Saved'}
                </span>
                <button
                  className='save-btn'
                  onClick={() => handleToggleSave(collection._id.toString())}>
                  {isSaved ? 'Unsave' : 'Save'}
                </button>
              </li>
            );
          })}
        </ul>
        <button onClick={onClose} className='close-btn'>
          Close
        </button>
      </div>
    </div>
  );
};

export default SaveToCollectionModal;
