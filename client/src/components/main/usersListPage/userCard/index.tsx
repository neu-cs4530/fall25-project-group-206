import './index.css';
import { useState } from 'react';
import { SafeDatabaseUser } from '../../../../types/types';
import useFollowButton from '../../../../hooks/useFollowButton';
import useUserContext from '../../../../hooks/useUserContext';

/**
 * Interface representing the props for the User component.
 *
 * user - The user object containing details about the user.
 * handleUserCardViewClickHandler - The function to handle the click event on the user card.
 */
interface UserProps {
  user: SafeDatabaseUser;
  handleUserCardViewClickHandler: (user: SafeDatabaseUser) => void;
}

/**
 * User component renders the details of a user including its username and dateJoined.
 * Clicking on the component triggers the handleUserPage function,
 * and clicking on a tag triggers the clickTag function.
 *
 * @param user - The user object containing user details.
 */
const UserCardView = (props: UserProps) => {
  const { user, handleUserCardViewClickHandler } = props;
  const { user: currentUser } = useUserContext();

  // Check if current user is following this user
  const isFollowing = currentUser.following.some(id => id.toString() === user._id.toString());

  // Check if this user follows the current user
  const followsYou = user.following.some(id => id.toString() === currentUser._id.toString());

  const isMutualFollow = isFollowing && followsYou;

  const isOwnProfile = currentUser.username === user.username;

  // Hooks for follow + bookmark logic
  const {
    isFollowing: followingState,
    isLoading,
    handleToggleFollow,
  } = useFollowButton(user.username, isFollowing);

  const [followerCount, setFollowerCount] = useState<number>(user.followers.length);

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    const newFollowingState = await handleToggleFollow();
    setFollowerCount(prev => (newFollowingState ? prev + 1 : Math.max(0, prev - 1)));
  };

  return (
    <div className='user right_padding' onClick={() => handleUserCardViewClickHandler(user)}>
      <div className='user_mid'>
        <div className='userHeader'>
          <div className='userUsername'>{user.username}</div>
          <div className='followsYou'>
            {!isOwnProfile && (
              <>
                {isMutualFollow && <span className='mutual-badge'>Mutual</span>}
                {!isMutualFollow && followsYou && (
                  <span className='follows-you-badge'>Follows you</span>
                )}
              </>
            )}
          </div>
        </div>
        <div></div>
        {user.biography && <div className='userBio'>{user.biography}</div>}
      </div>

      <div className='userStats'>
        <div>joined {new Date(user.dateJoined).toUTCString()}</div>
        <div>
          {followerCount} followers · {user.following.length} following
        </div>
      </div>

      {!isOwnProfile && (
        <button
          className={`follow-btn ${followingState ? 'following' : ''}`}
          onClick={handleFollowClick}
          disabled={isLoading}>
          {isLoading ? 'Loading...' : followingState ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
};

export default UserCardView;
