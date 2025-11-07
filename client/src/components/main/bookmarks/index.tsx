import './index.css';
import useBookmarksPage from '../../../hooks/useBookmarksPage';
import { useNavigate } from 'react-router-dom';
import useUserContext from '../../../hooks/useUserContext';

/**
 * BookmarksPage component displays all bookmarks for the logged-in user.
 * @returns A JSX element representing the bookmarks page.
 */
const BookmarksPage = () => {
  const { user } = useUserContext();
  const { collections, communities, users, loading } = useBookmarksPage();
  const navigate = useNavigate();

  if (loading) {
    return <div className='bookmarks-page'>Loading bookmarks...</div>;
  }

  /**
   * Handles click on a collection bookmark to navigate to its page.
   * @param collectionId - The ID of the collection.
   * @param owner - The owner of the collection.
   */
  const handleCollectionClick = (collectionId: string, owner: string) => {
    navigate(`/collections/${owner}/${collectionId}`);
  };

  /**
   * Handles click on a community bookmark to navigate to its page.
   * @param communityId - The ID of the community.
   */
  const handleCommunityClick = (communityId: string) => {
    navigate(`/communities/${communityId}`);
  };

  /**
   * Handles click on a user bookmark to navigate to their page.
   * @param username - The username of the user.
   */
  const handleUserClick = (username: string) => {
    navigate(`/user/${username}`);
  };

  return (
    <div className='bookmarks-page'>
      <div className='bookmarks-header'>
        <h1 className='bookmarks-title'>{user.username}'s Bookmarks</h1>
      </div>

      {/* COLLECTIONS SECTION */}
      {collections.length > 0 && (
        <>
          <h2 className='bookmark-section-title'>Collections</h2>
          <div className='bookmarks-list'>
            {collections.map(bookmark => {
              const c = bookmark.populatedTarget;
              if (!c) return null;
              return (
                <div
                  key={c._id.toString()}
                  className='bookmark-card'
                  onClick={() => handleCollectionClick(c._id.toString(), c.username)}>
                  <h3 className='bookmark-name'>{c.name}</h3>
                  <p className='bookmark-description'>{c.description}</p>
                  <p className='bookmark-meta'>
                    {c.isPrivate ? 'Private' : 'Public'} • {c.questions?.length || 0} Questions
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* COMMUNITIES SECTION */}
      {communities.length > 0 && (
        <>
          <h2 className='bookmark-section-title'>Communities</h2>
          <div className='bookmarks-list'>
            {communities.map(bookmark => {
              const comm = bookmark.populatedTarget;
              if (!comm) return null;
              return (
                <div
                  key={comm._id.toString()}
                  className='bookmark-card'
                  onClick={() => handleCommunityClick(comm._id.toString())}>
                  <h3 className='bookmark-name'>{comm.name}</h3>
                  <p className='bookmark-description'>{comm.description}</p>
                  <p className='bookmark-meta'>
                    {comm.visibility} • {comm.participants.length} participants
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* USERS SECTION */}
      {users.length > 0 && (
        <>
          <h2 className='bookmark-section-title'>Users</h2>
          <div className='bookmarks-list'>
            {users.map(bookmark => {
              const u = bookmark.populatedTarget;
              if (!u) return null;
              return (
                <div
                  key={u._id.toString()}
                  className='bookmark-card'
                  onClick={() => handleUserClick(u.username)}>
                  <h3 className='bookmark-name'>{u.username}</h3>
                  <p className='bookmark-description'>{u.bio || 'No description available.'}</p>
                  <p className='bookmark-meta'>Reputation: {u.reputation ?? 0}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* FALLBACK */}
      {collections.length === 0 && communities.length === 0 && users.length === 0 && (
        <p className='no-bookmarks'>No bookmarks yet.</p>
      )}
    </div>
  );
};

export default BookmarksPage;
