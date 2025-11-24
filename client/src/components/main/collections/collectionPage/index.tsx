// client/src/components/main/collections/collectionPage/index.tsx
import QuestionView from '../../questionPage/question';
import useCollectionPage from '../../../../hooks/useCollectionPage';
import './index.css';
import DeleteCollectionButton from '../deleteCollectionButton';
import BookmarkButton from '../../bookmarkButton';

/**
 * Displays a single collection page with its metadata, description,
 * and list of associated questions.
 */
const CollectionPage = () => {
  const { collection, isOwner } = useCollectionPage();

  if (!collection) {
    return <div className='collection-page loading'>Loading...</div>;
  }

  return (
    <div className='collection-page'>
      <header className='collection-header'>
        <div className='collection-header-top'>
          <div className='collection-title-wrap'>
            <h1 className='collection-title'>{collection.name}</h1>
            <span className='collection-title-accent' />
          </div>

          <div className='collection-header-actions'>
            <BookmarkButton targetId={collection._id.toString()} targetType='Collection' />
            {isOwner && <DeleteCollectionButton collectionId={collection._id.toString()} />}
          </div>
        </div>

        <p className='collection-description'>{collection.description}</p>
        <p className='collection-meta'>
          {collection.isPrivate ? 'Private' : 'Public'} • by {collection.username}
        </p>
      </header>

      <section className='collection-questions-section'>
        <h2 className='collection-questions-title'>
          Questions in this collection ({collection.questions.length})
        </h2>

        {collection.questions.length === 0 ? (
          <p className='collection-questions-empty'>
            There are no questions in this collection yet.
          </p>
        ) : (
          <ul className='collection-questions-list'>
            {collection.questions.map(q => (
              <li key={q._id.toString()} className='collection-question-card'>
                <QuestionView question={q} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default CollectionPage;
