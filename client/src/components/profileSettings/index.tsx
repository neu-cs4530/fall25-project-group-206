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
import use2FA from '../../hooks/use2FA';
import Enable2FAModal from '../twoFactorAuth/Enable2FAModal';

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
  const [show2FAModal, setShow2FAModal] = React.useState(false);
  const [twoFASuccess, setTwoFASuccess] = React.useState('');
  const [twoFAError, setTwoFAError] = React.useState('');

  const {
    isEnabled: is2FAEnabled,
    disableWith2FA,
    fetchTwoFAStatus,
  } = use2FA(userData ? userData.username : '');

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

  const handle2FAToggle = async () => {
    setTwoFAError('');
    setTwoFASuccess('');

    if (is2FAEnabled) {
      const success = await disableWith2FA();
      if (success) {
        setTwoFASuccess('2FA disabled successfully!');
      } else {
        setTwoFAError('Failed to disable 2FA');
      }
    } else {
      setShow2FAModal(true);
    }
  };

  const handle2FASuccess = async () => {
    setShow2FAModal(false);
    setTwoFASuccess('2FA enabled successfully!');
    setTwoFAError('');
    // Refresh the 2FA status so checkbox updates
    await fetchTwoFAStatus();
  };

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
                Allow anyone to message me (not just mutual follows)
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

            {/* ---- Two-Factor Authentication Section ---- */}
            {canEditProfile && (
              <>
                <h4>Security Settings</h4>
                {twoFASuccess && <p className='success-message'>{twoFASuccess}</p>}
                {twoFAError && <p className='error-message'>{twoFAError}</p>}
                <div className='twofa-section'>
                  <label>
                    <input
                      type='checkbox'
                      checked={is2FAEnabled}
                      onChange={handle2FAToggle}
                      disabled={!canEditProfile}
                    />
                    Enable Two-Factor Authentication (2FA)
                  </label>
                  <p className='info-text'>
                    {is2FAEnabled
                      ? '2FA is currently enabled on your account. You need to enter a code from your authenticator app each time you log in.'
                      : 'Enable 2FA to add an extra layer of security to your account.'}
                  </p>
                </div>
              </>
            )}

            {show2FAModal && (
              <Enable2FAModal
                username={userData?.username || ''}
                onSuccess={handle2FASuccess}
                onCancel={() => setShow2FAModal(false)}
              />
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
