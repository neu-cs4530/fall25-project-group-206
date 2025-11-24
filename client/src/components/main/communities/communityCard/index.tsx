import './index.css';
import { DatabaseCommunity } from '../../../../types/types';
import useCommunityCard from '../../../../hooks/useCommunityCard';
import CommunityMembershipButton from '../communityMembershipButton';
import BookmarkButton from '../../bookmarkButton';

/**
 * CommunityCard component displays information about a community, including its name,
 * description, visibility, and number of participants. It also provides buttons to view,
 * join, or bookmark the community.
 */
const CommunityCard = ({
  community,
  setError,
}: {
  community: DatabaseCommunity;
  setError: (error: string | null) => void;
}) => {
  const { handleViewCommunity } = useCommunityCard(community, setError);

  return (
    <div className='community-card'>
      <div className='community-card-header'>
        <h3 className='community-card-title'>{community.name}</h3>
        <BookmarkButton targetId={community._id.toString()} targetType='Community' />
      </div>

      <p className='community-card-description'>{community.description}</p>
      <p className='community-card-meta'>
        <strong>Visibility:</strong> {community.visibility}
      </p>
      <p className='community-card-meta'>
        <strong>Participants:</strong> {community.participants.length}
      </p>

      <div className='community-card-actions'>
        <button className='btn-action-community' onClick={handleViewCommunity}>
          View Community
        </button>
        <CommunityMembershipButton community={community} />
      </div>
    </div>
  );
};

export default CommunityCard;
