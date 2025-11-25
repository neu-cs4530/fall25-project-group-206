import * as React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';
import useProfileSettings from '../../hooks/useProfileSettings';
import useUserContext from '../../hooks/useUserContext';
import useFollowButton from '../../hooks/useFollowButton';
import FollowersList from './FollowersList';
import FollowingList from './FollowingList';
import use2FA from '../../hooks/use2FA';
import Enable2FAModal from '../twoFactorAuth/Enable2FAModal';
import { TabsHeader, TabPanel } from './tabs';

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
    handleUpdateGoogleSSOSetting,
  } = useProfileSettings();

  const { user: currentUser } = useUserContext();
  const [refreshFollowers, setRefreshFollowers] = React.useState(false);
  const [refreshFollowing, setRefreshFollowing] = React.useState(false);
  const [show2FAModal, setShow2FAModal] = React.useState(false);
  const [twoFASuccess, setTwoFASuccess] = React.useState('');
  const [twoFAError, setTwoFAError] = React.useState('');
  type TabId = 'overview' | 'password' | 'messaging' | 'security' | 'social' | 'danger';
  const [active, setActive] = React.useState<TabId>('overview');
  const [googleSSODisabled, setGoogleSSODisabled] = React.useState(
    userData ? !userData.isGoogleSSO : false,
  );

  React.useEffect(() => {
    if (userData) {
      setGoogleSSODisabled(!userData.isGoogleSSO);
    }
  }, [userData]);

  const items = [
    { id: 'overview', label: 'Overview' },
    { id: 'messaging', label: 'Messaging' },
    { id: 'security', label: 'Security' },
    { id: 'password', label: 'Password' },
    { id: 'social', label: 'Social' },
    { id: 'danger', label: 'Danger Zone' },
  ];
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
    } finally {
      setRefreshFollowers(v => !v);
      setRefreshFollowing(v => !v);
    }
  };

  const handleSetActive = (id: string) => setActive(id as TabId);

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
          <div className='tabs'>
            {' '}
            <TabsHeader items={items} active={active} setActive={handleSetActive} />
            {/* OVERVIEW */}
            <TabPanel id='overview' active={active}>
              <p>
                <strong>Username:</strong> {userData.username}
              </p>
              <p>
                <strong>Email:</strong> {userData.email}
              </p>
              <p>
                <strong>Date Joined:</strong>{' '}
                {userData.dateJoined ? new Date(userData.dateJoined).toLocaleDateString() : 'N/A'}
              </p>

              <p>
                <strong>Biography:</strong>
              </p>
              <div className='bio-section'>
                {!editBioMode ? (
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
                ) : (
                  canEditProfile && (
                    <div className='bio-edit'>
                      <input
                        className='input-text'
                        value={newBio}
                        onChange={e => setNewBio(e.target.value)}
                      />
                      <button className='button button-primary' onClick={handleUpdateBiography}>
                        Save
                      </button>
                      <button
                        className='button button-danger'
                        onClick={() => setEditBioMode(false)}>
                        Cancel
                      </button>
                    </div>
                  )
                )}
              </div>

              <button className='button button-primary' onClick={handleViewCollectionsPage}>
                View Collections
              </button>
            </TabPanel>
            {/* MESSAGING */}
            <TabPanel id='messaging' active={active}>
              {canEditProfile ? (
                <label>
                  <input
                    type='checkbox'
                    checked={allowOpenMessaging}
                    onChange={e => handleUpdateMessagingSetting(e.target.checked)}
                  />
                  Allow anyone to message me (not just mutual follows)
                </label>
              ) : (
                <p>Only the profile owner can modify messaging settings.</p>
              )}
            </TabPanel>
            {/* SECURITY (2FA) & Google SSO */}
            <TabPanel id='security' active={active}>
              {canEditProfile && (
                <>
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
                        ? '2FA is enabled. You will enter a code from your authenticator on login.'
                        : 'Enable 2FA to add an extra layer of security to your account.'}
                    </p>
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    {!googleSSODisabled ? (
                      <div className='google-sso-section'>
                        <label>
                          <input
                            type='checkbox'
                            checked={googleSSODisabled}
                            onChange={async e => {
                              const disabled = e.target.checked;
                              await handleUpdateGoogleSSOSetting(!disabled);
                            }}
                          />
                          Disable Google Single Sign-On (SSO)
                        </label>

                        <p className='info-text'>
                          {!googleSSODisabled
                            ? 'Google SSO is currently enabled.'
                            : 'Google SSO is currently disabled.'}
                        </p>
                      </div>
                    ) : (
                      <div className='google-sso-section'>
                        Your Google Account is not currently linked:
                        <button
                          onClick={() => {
                            handleUpdateGoogleSSOSetting(true);
                            window.location.href = '/api/auth/google';
                          }}>
                          Connect Google SSO
                        </button>
                      </div>
                    )}
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
            </TabPanel>
            {/* PASSWORD */}
            <TabPanel id='password' active={active}>
              {canEditProfile ? (
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
              ) : (
                <p>Only the profile owner can reset this password.</p>
              )}
            </TabPanel>
            {/* SOCIAL */}
            <TabPanel id='social' active={active}>
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
              <div className='follow-lists'>
                <FollowersList
                  username={userData.username}
                  refreshTrigger={refreshFollowers}
                  onUserClick={() => setActive('overview')}
                />
                <FollowingList
                  username={userData.username}
                  refreshTrigger={refreshFollowing}
                  onUserClick={() => setActive('overview')}
                />
              </div>
            </TabPanel>
            {/* DANGER */}
            <TabPanel id='danger' active={active}>
              {canEditProfile ? (
                <>
                  <h4>Danger Zone</h4>
                  <button className='button button-danger' onClick={handleDeleteUser}>
                    Delete This User
                  </button>
                </>
              ) : (
                <p>Only the profile owner can delete this account.</p>
              )}
            </TabPanel>
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
        ) : (
          <p>No user data found. Make sure the username parameter is correct.</p>
        )}
      </div>
    </div>
  );
};

export default ProfileSettings;
