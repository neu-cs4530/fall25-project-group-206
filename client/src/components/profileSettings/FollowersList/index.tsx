import * as React from 'react';
import './index.css';
import useFollowersList from '../../../hooks/useFollowersList';
import useFollowButton from '../../../hooks/useFollowButton';
import useUserContext from '../../../hooks/useUserContext';
import { Link } from 'react-router-dom';
import { SafeDatabaseUser } from '../../../types/types';

interface FollowersListProps {
  username: string;
  /** flip this boolean to force a refetch after follow/unfollow */
  refreshTrigger?: boolean;
  /** callback when a user link is clicked */
  onUserClick?: () => void;
}

interface FollowerItemProps {
  follower: SafeDatabaseUser;
  currentUsername: string;
  onFollowChange: () => void;
  onUserClick?: () => void;
}

/**
 * Individual follower item with follow button
 */
const FollowerItem = ({ follower, onFollowChange, onUserClick }: FollowerItemProps) => {
  const { user: currentUser } = useUserContext();

  // Check if current user is following this follower
  const initialIsFollowing = Boolean(
    currentUser?.following.some(id => id.toString() === follower._id.toString()),
  );

  const { isFollowing, isLoading, handleToggleFollow } = useFollowButton(
    follower.username,
    initialIsFollowing,
  );

  const onToggle = async () => {
    await handleToggleFollow();
    onFollowChange(); // Trigger parent refetch
  };

  // Don't show follow button if this is the current logged-in user's card
  const isCurrentUser = currentUser?.username === follower.username;

  return (
    <li key={follower._id.toString()} className='follower-item'>
      <Link to={`/user/${follower.username}`} className='follower-link' onClick={onUserClick}>
        <div className='follower-info'>
          <span className='follower-username'>{follower.username}</span>
          {follower.biography && <span className='follower-bio'>{follower.biography}</span>}
        </div>
      </Link>
      {!isCurrentUser && (
        <button
          className={`button ${isFollowing ? 'button-secondary' : 'button-primary'} follow-btn-inline`}
          onClick={e => {
            e.preventDefault();
            onToggle();
          }}
          disabled={isLoading}>
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      )}
    </li>
  );
};

/**
 * Component to display a list of followers for a user.
 */
const FollowersList = ({ username, refreshTrigger, onUserClick }: FollowersListProps) => {
  const { followers, isLoading, error, refetch } = useFollowersList(username);

  // Re-fetch whenever the trigger flips
  React.useEffect(() => {
    if (typeof refreshTrigger !== 'undefined') {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  if (isLoading) {
    return <div className='followers-list loading'>Loading followers...</div>;
  }

  if (error) {
    return <div className='followers-list error'>{error}</div>;
  }

  return (
    <div className='followers-list'>
      <h3 className='followers-title'>Followers ({followers.length})</h3>
      {followers.length === 0 ? (
        <p className='no-followers'>No followers yet</p>
      ) : (
        <ul className='followers-items'>
          {followers.map(follower => (
            <FollowerItem
              key={follower._id.toString()}
              follower={follower}
              currentUsername={username}
              onFollowChange={refetch}
              onUserClick={onUserClick}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default FollowersList;
