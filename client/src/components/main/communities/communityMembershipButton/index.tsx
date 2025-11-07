import { DatabaseCommunity } from '../../../../types/types';
import useCommunityMembershipButton from '../../../../hooks/useCommunityMembershipButton';
import './index.css';

/**
 * CommunityMembershipButton component allows users to join or leave a community.
 * It displays a button that toggles between "Join" and "Leave" based on the user's membership status.
 */
const CommunityMembershipButton = ({ community }: { community: DatabaseCommunity }) => {
  const { username, handleCommunityMembership, error } = useCommunityMembershipButton();

  return (
    <>
      <button
        className='btn-action-community'
        onClick={() => handleCommunityMembership(community._id)}>
        {!community.participants.includes(username) ? 'Join' : 'Leave'}
      </button>
      {error && <p className='community-error'>{error}</p>}
    </>
  );
};

export default CommunityMembershipButton;
