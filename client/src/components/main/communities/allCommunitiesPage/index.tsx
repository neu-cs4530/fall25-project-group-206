import './index.css';
import useAllCommunitiesPage from '../../../../hooks/useAllCommunitiesPage';
import CommunityCard from '../communityCard';
import NewCommunityButton from '../newCommunityButton';

/**
 * AllCommunitiesPage component displays a list of communities and allows users to search for and join them.
 */
const AllCommunitiesPage = () => {
  const { communities, search, handleInputChange, error, setError } = useAllCommunitiesPage();

  return (
    <div className='community-page'>
      <h2 className='community-title'>Communities</h2>
      <div className='community-controls'>
        <input
          className='community-search'
          placeholder='Search communities ...'
          type='text'
          value={search}
          onChange={handleInputChange}
        />
        <NewCommunityButton />
      </div>
      {error && <p className='community-error'>{error}</p>}
      <div className='communities-list'>
        {communities
          .filter(community => community.name.toLowerCase().includes(search))
          .map(community => (
            <CommunityCard
              key={community._id.toString()}
              community={community}
              setError={setError}
            />
          ))}
      </div>
    </div>
  );
};

export default AllCommunitiesPage;
