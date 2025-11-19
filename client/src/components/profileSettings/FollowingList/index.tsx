import * as React from 'react';
import './index.css';
import useFollowingList from '../../../hooks/useFollowingList';
import useFollowButton from '../../../hooks/useFollowButton';
import useUserContext from '../../../hooks/useUserContext';
import { Link } from 'react-router-dom';
import { SafeDatabaseUser } from '../../../types/types';

interface FollowingListProps {
  username: string;
  /** flip this boolean to force a refetch after follow/unfollow */
  refreshTrigger?: boolean;
  /** callback when a user link is clicked */
  onUserClick?: () => void;
}

interface FollowingItemProps {
  user: SafeDatabaseUser;
  currentUsername: string;
  onFollowChange: () => void;
  onUserClick?: () => void;
}

/**
 * Individual following item with unfollow button
 */
const FollowingItem = ({ user, onFollowChange, onUserClick }: FollowingItemProps) => {
  const { user: currentUser } = useUserContext();

  // Check if current user is following this user
  const initialIsFollowing = Boolean(
    currentUser?.following.some(id => id.toString() === user._id.toString()),
  );

  const { isFollowing, isLoading, handleToggleFollow } = useFollowButton(
    user.username,
    initialIsFollowing,
  );

  const onToggle = async () => {
    await handleToggleFollow();
    onFollowChange(); // Trigger parent refetch
  };

  // Don't show follow button if this is the current logged-in user's card
  const isCurrentUser = currentUser?.username === user.username;

  return (
    <li key={user._id.toString()} className='following-item'>
      <Link to={`/user/${user.username}`} className='following-link' onClick={onUserClick}>
        <div className='following-info'>
          <span className='following-username'>{user.username}</span>
          {user.biography && <span className='following-bio'>{user.biography}</span>}
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
 * Component to display a list of users that a user is following.
 */
const FollowingList = ({ username, refreshTrigger, onUserClick }: FollowingListProps) => {
  const { following, isLoading, error, refetch } = useFollowingList(username);

  // Re-fetch whenever the trigger flips
  React.useEffect(() => {
    if (typeof refreshTrigger !== 'undefined') {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  if (isLoading) {
    return <div className='following-list loading'>Loading following...</div>;
  }

  if (error) {
    return <div className='following-list error'>{error}</div>;
  }

  return (
    <div className='following-list'>
      <h3 className='following-title'>Following ({following.length})</h3>
      {following.length === 0 ? (
        <p className='no-following'>Not following anyone yet</p>
      ) : (
        <ul className='following-items'>
          {following.map(user => (
            <FollowingItem
              key={user._id.toString()}
              user={user}
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

export default FollowingList;
