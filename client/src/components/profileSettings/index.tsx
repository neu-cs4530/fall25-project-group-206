import * as React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';
import useProfileSettings from '../../hooks/useProfileSettings';
import useUserContext from '../../hooks/useUserContext';
import useFollowButton from '../../hooks/useFollowButton';
import useBookmarkToggle from '../../hooks/useBookmarkToggle';
import FollowersList from './FollowersList';
import FollowingList from './FollowingList';

const ProfileSettings: React.FC = () => {
  const {
    userData,
    loading,
    editBioMode,
    newBio,
    newPassword,
    confirmNewPassword,
    successMessage,
    errorMessage,
    showConfirmation,
    pendingAction,
    canEditProfile,
    showPassword,
    allowOpenMessaging,
    togglePasswordVisibility,
    setEditBioMode,
    setNewBio,
    setNewPassword,
    setConfirmNewPassword,
    setShowConfirmation,
    handleResetPassword,
    handleUpdateBiography,
    handleDeleteUser,
    handleViewCollectionsPage,
    handleUpdateMessagingSetting,
  } = useProfileSettings();

  const { user: currentUser } = useUserContext();
  const [refreshFollowers, setRefreshFollowers] = React.useState(false);
  const [refreshFollowing, setRefreshFollowing] = React.useState(false);

  // Determine initial follow state when viewing another user's profile
  const initialIsFollowing = Boolean(
    currentUser &&
      userData &&
      currentUser.following.some(id => id.toString() === userData._id.toString()),
  );

  const onToggleFollow = async () => {
    try {
      await handleToggleFollow();
      handleToggleBookmark();
    } finally {
      setRefreshFollowers(v => !v);
      setRefreshFollowing(v => !v);
    }
  };

  const { handleToggleBookmark } = useBookmarkToggle(
    userData ? userData._id.toString() : '',
    'User',
  );

  const {
    isFollowing,
    isLoading: followLoading,
    error: followError,
    handleToggleFollow,
  } = useFollowButton(userData ? userData.username : '', initialIsFollowing);

  if (loading) {
    return (
      <div className='profile-settings'>
        <div className='profile-card'>
          <h2>Loading user data...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className='profile-settings'>
      <div className='profile-card'>
        <h2>Profile</h2>

        {successMessage && <p className='success-message'>{successMessage}</p>}
        {errorMessage && <p className='error-message'>{errorMessage}</p>}

        {userData ? (
          <>
            <h4>General Information</h4>
            <p>
              <strong>Username:</strong> {userData.username}
            </p>

            {/* ---- Biography Section ---- */}
            <p>
              <strong>Biography:</strong>
            </p>
            <div className='bio-section'>
              {!editBioMode && (
                <>
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {userData.biography || 'No biography yet.'}
                  </Markdown>
                  {canEditProfile && (
                    <button
                      className='button button-primary'
                      onClick={() => {
                        setEditBioMode(true);
                        setNewBio(userData.biography || '');
                      }}>
                      Edit
                    </button>
                  )}
                </>
              )}

              {editBioMode && canEditProfile && (
                <div className='bio-edit'>
                  <input
                    className='input-text'
                    type='text'
                    value={newBio}
                    onChange={e => setNewBio(e.target.value)}
                  />
                  <button className='button button-primary' onClick={handleUpdateBiography}>
                    Save
                  </button>
                  <button className='button button-danger' onClick={() => setEditBioMode(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {canEditProfile && (
              <label>
                <input
                  type='checkbox'
                  checked={allowOpenMessaging}
                  onChange={e => handleUpdateMessagingSetting(e.target.checked)}
                />
                Allow anyone I follow to message me (not just mutual follows)
              </label>
            )}

            <p>
              <strong>Date Joined:</strong>{' '}
              {userData.dateJoined ? new Date(userData.dateJoined).toLocaleDateString() : 'N/A'}
            </p>

            <button className='button button-primary' onClick={handleViewCollectionsPage}>
              View Collections
            </button>

            {/* Follow / Unfollow button (only shown when viewing someone else's profile) */}
            {!canEditProfile && currentUser && userData && (
              <div className='follow-actions'>
                <button
                  className={`button ${isFollowing ? 'button-secondary' : 'button-primary'}`}
                  onClick={onToggleFollow}
                  disabled={followLoading}>
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                {followError && <span className='error-message'>{followError}</span>}
              </div>
            )}

            {/* ---- Reset Password Section ---- */}
            {canEditProfile && (
              <>
                <h4>Reset Password</h4>
                <input
                  className='input-text'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='New Password'
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <input
                  className='input-text'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Confirm New Password'
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                />
                <div className='password-actions'>
                  <button className='button button-secondary' onClick={togglePasswordVisibility}>
                    {showPassword ? 'Hide Passwords' : 'Show Passwords'}
                  </button>
                  <button className='button button-primary' onClick={handleResetPassword}>
                    Reset
                  </button>
                </div>
              </>
            )}

            {/* ---- Danger Zone (Delete User) ---- */}
            {canEditProfile && (
              <>
                <h4>Danger Zone</h4>
                <button className='button button-danger' onClick={handleDeleteUser}>
                  Delete This User
                </button>
              </>
            )}

            {/* Followers / Following lists */}
            {userData && (
              <div className='follow-lists'>
                <FollowersList username={userData.username} refreshTrigger={refreshFollowers} />
                <FollowingList username={userData.username} refreshTrigger={refreshFollowing} />
              </div>
            )}
          </>
        ) : (
          <p>No user data found. Make sure the username parameter is correct.</p>
        )}

        {/* ---- Confirmation Modal for Delete ---- */}
        {showConfirmation && (
          <div className='modal'>
            <div className='modal-content'>
              <p>
                Are you sure you want to delete user <strong>{userData?.username}</strong>? This
                action cannot be undone.
              </p>
              <div className='modal-actions'>
                <button className='button button-danger' onClick={() => pendingAction?.()}>
                  Confirm
                </button>
                <button
                  className='button button-secondary'
                  onClick={() => setShowConfirmation(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSettings;
