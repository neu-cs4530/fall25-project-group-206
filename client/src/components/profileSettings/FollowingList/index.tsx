import * as React from 'react';
import './index.css';
import useFollowingList from '../../../hooks/useFollowingList';
import { Link } from 'react-router-dom';

interface FollowingListProps {
  username: string;
  /** flip this boolean to force a refetch after follow/unfollow */
  refreshTrigger?: boolean;
}

/**
 * Component to display a list of users that a user is following.
 */
const FollowingList = ({ username, refreshTrigger }: FollowingListProps) => {
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
            <li key={user._id.toString()} className='following-item'>
              <Link to={`/user/${user.username}`} className='following-link'>
                <div className='following-info'>
                  <span className='following-username'>{user.username}</span>
                  {user.biography && <span className='following-bio'>{user.biography}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FollowingList;
