import './index.css';
import { DatabaseCommunity } from '../../../../types/types';
import useCommunityCard from '../../../../hooks/useCommunityCard';
import CommunityMembershipButton from '../communityMembershipButton';
import useBookmarkToggle from '../../../../hooks/useBookmarkToggle';
import { Star, StarOff } from 'lucide-react';

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

  const { isBookmarked, loading, handleToggleBookmark } = useBookmarkToggle(
    community._id.toString(),
    'Community',
  );

  return (
    <div className='community-card'>
      <div className='community-card-header'>
        <h3 className='community-card-title'>{community.name}</h3>

        {/* Lucide-react star icon for bookmarking */}
        <button
          className='bookmark-icon-btn'
          onClick={handleToggleBookmark}
          disabled={loading}
          title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}>
          {isBookmarked ? (
            <StarOff size={22} color='#facc15' /* gold tone */ fill='#facc15' strokeWidth={2} />
          ) : (
            <Star size={22} color='#9ca3af' strokeWidth={2} />
          )}
        </button>
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
