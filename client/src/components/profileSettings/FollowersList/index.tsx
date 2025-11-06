import './index.css';
import useFollowersList from '../../../hooks/useFollowersList';
import { Link } from 'react-router-dom';

interface FollowersListProps {
  username: string;
}

/**
 * Component to display a list of followers for a user.
 */
const FollowersList = ({ username }: FollowersListProps) => {
  const { followers, isLoading, error } = useFollowersList(username);

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
            <li key={follower._id.toString()} className='follower-item'>
              <Link to={`/user/${follower.username}`} className='follower-link'>
                <div className='follower-info'>
                  <span className='follower-username'>{follower.username}</span>
                  {follower.biography && <span className='follower-bio'>{follower.biography}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FollowersList;
