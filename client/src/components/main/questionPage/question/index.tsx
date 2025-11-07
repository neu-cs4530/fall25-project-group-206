import './index.css';
import { getMetaData } from '../../../../tool';
import { PopulatedDatabaseQuestion } from '../../../../types/types';
import SaveToCollectionModal from '../../collections/saveToCollectionModal';
import useQuestionView from '../../../../hooks/useQuestionView';

/**
 * Interface representing the props for the Question component.
 *
 * q - The question object containing details about the question.
 */
interface QuestionProps {
  question: PopulatedDatabaseQuestion;
}

/**
 * Question component renders the details of a question including its title, tags, author, answers, and views.
 * Clicking on the component triggers the handleAnswer function,
 * and clicking on a tag triggers the clickTag function.
 *
 * @param q - The question object containing question details.
 */
const QuestionView = ({ question }: QuestionProps) => {
  const { clickTag, handleAnswer, handleSaveClick, closeModal, isModalOpen, selectedQuestion } =
    useQuestionView();

  return (
    <div
      className='question right_padding'
      onClick={() => {
        if (question._id) {
          handleAnswer(question._id);
        }
      }}>
      <div className='postStats'>
        <div>{question.answers.length || 0} answers</div>
        <div>{question.views.length} views</div>
      </div>
      <div className='question_mid'>
        <div className='postTitle'>{question.title}</div>
        <div className='question_tags'>
          {question.tags.map(tag => (
            <button
              key={String(tag._id)}
              className='question_tag_button'
              onClick={e => {
                e.stopPropagation();
                clickTag(tag.name);
              }}>
              {tag.name}
            </button>
          ))}
        </div>
      </div>
      <div className='lastActivity'>
        <div className='question_author'>{question.askedBy}</div>
        <div>&nbsp;</div>
        <div className='question_meta'>asked {getMetaData(new Date(question.askDateTime))}</div>
      </div>

      <button
        onClick={e => {
          e.stopPropagation();
          handleSaveClick(question);
        }}
        className='collections-btn'>
        Edit My Collections
      </button>

      {isModalOpen && selectedQuestion && (
        <SaveToCollectionModal question={selectedQuestion} onClose={closeModal} />
      )}
    </div>
  );
};

export default QuestionView;
