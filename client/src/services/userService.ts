import axios from 'axios';
import { UserRegistration, UserCredentials, SafeDatabaseUser } from '../types/types';
import api from './config';

const USER_API_URL = `/api/user`;

/**
 * Function to get users
 *
 * @throws Error if there is an issue fetching users.
 */
const getUsers = async (): Promise<SafeDatabaseUser[]> => {
  const res = await api.get(`${USER_API_URL}/getUsers`);
  if (res.status !== 200) {
    throw new Error('Error when fetching users');
  }
  return res.data;
};

/**
 * Function to get users
 *
 * @throws Error if there is an issue fetching users.
 */
const getUserByUsername = async (username: string): Promise<SafeDatabaseUser> => {
  const res = await api.get(`${USER_API_URL}/getUser/${username}`);
  if (res.status !== 200) {
    throw new Error('Error when fetching user');
  }
  return res.data;
};

/**
 * Sends a POST request to create a new user account.
 *
 * @param user - The user credentials (username and password) for signup.
 * @returns {Promise<User>} The newly created user object.
 * @throws {Error} If an error occurs during the signup process.
 */
const createUser = async (user: UserRegistration): Promise<SafeDatabaseUser> => {
  try {
    const res = await api.post(`${USER_API_URL}/signup`, user);
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error while signing up: ${JSON.stringify(error.response.data)}`);
    } else {
      throw new Error('Error while signing up');
    }
  }
};

/**
 * Sends a POST request to authenticate a user.
 *
 * @param user - The user credentials (username and password) for login.
 * @returns {Promise<User>} The authenticated user object.
 * @throws {Error} If an error occurs during the login process.
 */
const loginUser = async (user: UserCredentials): Promise<SafeDatabaseUser> => {
  try {
    const res = await api.post(`${USER_API_URL}/login`, user);
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error while logging in: ${JSON.stringify(error.response.data)}`);
    } else {
      throw new Error('Error while logging in');
    }
  }
};

/**
 * Deletes a user by their username.
 * @param username - The unique username of the user
 * @returns A promise that resolves to the deleted user data
 * @throws {Error} If the request to the server is unsuccessful
 */
const deleteUser = async (username: string): Promise<SafeDatabaseUser> => {
  const res = await api.delete(`${USER_API_URL}/deleteUser/${username}`);
  if (res.status !== 200) {
    throw new Error('Error when deleting user');
  }
  return res.data;
};

/**
 * Resets the password for a user.
 * @param username - The unique username of the user
 * @param newPassword - The new password to be set for the user
 * @returns A promise that resolves to the updated user data
 * @throws {Error} If the request to the server is unsuccessful
 */
const resetPassword = async (username: string, newPassword: string): Promise<SafeDatabaseUser> => {
  const res = await api.patch(`${USER_API_URL}/resetPassword`, {
    username,
    password: newPassword,
  });
  if (res.status !== 200) {
    throw new Error('Error when resetting password');
  }
  return res.data;
};

/**
 * Updates the user's biography.
 * @param username The unique username of the user
 * @param newBiography The new biography to set for this user
 * @returns A promise resolving to the updated user
 * @throws Error if the request fails
 */
const updateBiography = async (
  username: string,
  newBiography: string,
): Promise<SafeDatabaseUser> => {
  const res = await api.patch(`${USER_API_URL}/updateBiography`, {
    username,
    biography: newBiography,
  });
  if (res.status !== 200) {
    throw new Error('Error when updating biography');
  }
  return res.data;
};

/**
 * Toggles the follow status between the current user and target user.
 * If currently following, will unfollow. If not following, will follow.
 *
 * @param currentUsername - The username of the user performing the action
 * @param targetUsername - The username of the user to follow/unfollow
 * @returns A promise that resolves to the updated current user data
 * @throws {Error} If the request to the server is unsuccessful
 */
const toggleFollowUser = async (
  currentUsername: string,
  targetUsername: string,
): Promise<SafeDatabaseUser> => {
  const res = await api.post(`${USER_API_URL}/toggleFollow`, {
    currentUsername,
    targetUsername,
  });
  if (res.status !== 200) {
    throw new Error('Error when toggling follow status');
  }
  return res.data;
};

/**
 * Retrieves the list of followers for a specific user.
 *
 * @param username - The username of the user whose followers to retrieve
 * @returns A promise that resolves to an array of follower user objects
 * @throws {Error} If the request to the server is unsuccessful
 */
const getFollowers = async (username: string): Promise<SafeDatabaseUser[]> => {
  const res = await api.get(`${USER_API_URL}/${username}/followers`);
  if (res.status !== 200) {
    throw new Error('Error when fetching followers');
  }
  return res.data;
};

/**
 * Retrieves the list of users that a specific user is following.
 *
 * @param username - The username of the user whose following list to retrieve
 * @returns A promise that resolves to an array of following user objects
 * @throws {Error} If the request to the server is unsuccessful
 */
const getFollowing = async (username: string): Promise<SafeDatabaseUser[]> => {
  const res = await api.get(`${USER_API_URL}/${username}/following`);
  if (res.status !== 200) {
    throw new Error('Error when fetching following');
  }
  return res.data;
};
/**
 * Updates the messaging setting for a user.
 *
 * @param username - The username of the user
 * @param allowOpenMessaging - Whether to allow open messaging (true) or require mutual follows (false)
 * @returns A promise that resolves to the updated user data
 * @throws {Error} If the request to the server is unsuccessful
 */
const updateMessagingSetting = async (
  username: string,
  allowOpenMessaging: boolean,
): Promise<SafeDatabaseUser> => {
  const res = await api.patch(`${USER_API_URL}/updateMessagingSetting`, {
    username,
    allowOpenMessaging,
  });
  if (res.status !== 200) {
    throw new Error('Error when updating messaging setting');
  }
  return res.data;
};

/**
 * Determines if currentUser can send a message to targetUser
 *
 * @param currentUser - The user attempting to send a message
 * @param targetUser - The user receiving the message
 * @returns boolean - true if messaging is allowed
 */
export const canSendMessage = async (
  currentUser: SafeDatabaseUser,
  targetUsername: string,
): Promise<boolean> => {
  // Can't message yourself
  if (currentUser.username.toString() === targetUsername.toString()) {
    return false;
  }

  const targetUser = await getUserByUsername(targetUsername);

  // If target has open messaging enabled, anyone can message them
  if (targetUser.allowOpenMessaging) {
    return true;
  }

  // Otherwise, require mutual following
  const currentUserFollowsTarget = currentUser.following.some(
    id => id.toString() === targetUser._id.toString(),
  );
  const targetFollowsCurrentUser = targetUser.followers.some(
    id => id.toString() === currentUser._id.toString(),
  );

  return currentUserFollowsTarget && targetFollowsCurrentUser;
};

/**
 * Generates a 2FA secret and QR code for a user.
 *
 * @param username - The username of the user to generate 2FA secret for
 * @returns A promise that resolves to an object containing the secret and QR code
 * @throws {Error} If the request to the server is unsuccessful
 */
const generate2FASecret = async (username: string): Promise<{ secret: string; qrCode: string }> => {
  try {
    const res = await api.post(`${USER_API_URL}/2fa/generate`, { username });
    if (res.status !== 200) {
      throw new Error('Error when generating 2FA secret');
    }
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error generating 2FA secret: ${error.response.data}`);
    } else {
      throw new Error('Error when generating 2FA secret');
    }
  }
};

/**
 * Enables 2FA for a user after verifying the token.
 *
 * @param username - The username of the user
 * @param secret - The 2FA secret to save
 * @param token - The 6-digit token from the authenticator app
 * @returns A promise that resolves to the updated user data
 * @throws {Error} If the request to the server is unsuccessful or token is invalid
 */
const enable2FA = async (
  username: string,
  secret: string,
  token: string,
): Promise<SafeDatabaseUser> => {
  try {
    const res = await api.post(`${USER_API_URL}/2fa/enable`, {
      username,
      secret,
      token,
    });
    if (res.status !== 200) {
      throw new Error('Error when enabling 2FA');
    }
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`${error.response.data}`);
    } else {
      throw new Error('Error when enabling 2FA');
    }
  }
};

/**
 * Disables 2FA for a user.
 *
 * @param username - The username of the user
 * @returns A promise that resolves to the updated user data
 * @throws {Error} If the request to the server is unsuccessful
 */
const disable2FA = async (username: string): Promise<SafeDatabaseUser> => {
  try {
    const res = await api.post(`${USER_API_URL}/2fa/disable`, { username });
    if (res.status !== 200) {
      throw new Error('Error when disabling 2FA');
    }
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error disabling 2FA: ${error.response.data}`);
    } else {
      throw new Error('Error when disabling 2FA');
    }
  }
};

/**
 * Verifies a 2FA token for a user during login.
 *
 * @param username - The username of the user
 * @param token - The 6-digit token from the authenticator app
 * @returns A promise that resolves to true if token is valid, false otherwise
 * @throws {Error} If the request to the server is unsuccessful
 */
const verify2FAToken = async (username: string, token: string): Promise<boolean> => {
  try {
    const res = await api.post(`${USER_API_URL}/2fa/verify`, {
      username,
      token,
    });
    if (res.status !== 200) {
      throw new Error('Error when verifying 2FA token');
    }
    return res.data.valid;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error verifying 2FA token: ${error.response.data}`);
    } else {
      throw new Error('Error when verifying 2FA token');
    }
  }
};

/**
 * Updates whether Google SSO is enabled for a user.
 *
 * @param username - The username of the user
 * @param isGoogleSSO - true to enable Google SSO, false to disable it
 * @returns A promise resolving to the updated user data
 * @throws {Error} If the request to the server is unsuccessful
 */
const updateGoogleSSOSetting = async (
  username: string,
  isGoogleSSO: boolean,
): Promise<SafeDatabaseUser> => {
  try {
    const res = await api.patch(`${USER_API_URL}/updateGoogleSSOSetting`, {
      username,
      isGoogleSSO,
    });

    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // Pass backend message directly to UI
      throw new Error(error.response.data || 'Failed to update Google SSO settings.');
    }

    throw new Error('Failed to update Google SSO settings.');
  }
};

export {
  getUsers,
  getUserByUsername,
  loginUser,
  createUser,
  deleteUser,
  resetPassword,
  updateBiography,
  toggleFollowUser,
  getFollowers,
  getFollowing,
  updateMessagingSetting,
  generate2FASecret,
  enable2FA,
  disable2FA,
  verify2FAToken,
  updateGoogleSSOSetting,
};
