import './index.css';
import useNewCommunityPage from '../../../../hooks/useNewCommunityPage';

const NewCommunityPage = () => {
  const {
    name,
    setName,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    error,
    handleNewCommunity,
  } = useNewCommunityPage();

  return (
    <div className='new-community-page'>
      <h2 className='new-community-title'>Create a New Community</h2>
      <h3>Community Name</h3>
      <input
        className='new-community-input'
        placeholder='Community name'
        type='text'
        onChange={e => setName(e.target.value)}
        value={name}
        required
      />
      <h3>Community Description</h3>
      <input
        className='new-community-input'
        placeholder='Community description'
        type='text'
        onChange={e => setDescription(e.target.value)}
        value={description}
        required
      />
      <label className='new-community-checkbox-label'>
        <input
          type='checkbox'
          checked={isPublic}
          onChange={() => setIsPublic(!isPublic)}
          className='new-community-checkbox'
        />
        Public Community
      </label>
      <button className='new-community-submit' onClick={handleNewCommunity}>
        Create
      </button>
      {error && <p className='new-community-error'>{error}</p>}
    </div>
  );
};

export default NewCommunityPage;
