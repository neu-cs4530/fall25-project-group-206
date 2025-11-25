import UserModel from '../models/users.model';
import {
  DatabaseUser,
  SafeDatabaseUser,
  User,
  UserCredentials,
  UserResponse,
  UsersResponse,
} from '../types/types';
import bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Saves a new user to the database.
 *
 * @param {User} user - The user object to be saved, containing user details like username, password, etc.
 * @param {string} ip - The IP address of the device attempting login.
 * @param {string} userAgent - The user-agent string of the device/browser.
 * @returns {Promise<UserResponse>} - Resolves with the saved user object (without the password) or an error message.
 */
export const saveUser = async (
  user: User,
  ip?: string,
  userAgent?: string,
): Promise<UserResponse> => {
  try {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;

    if (ip && userAgent) {
      const deviceId = getDeviceId(ip, userAgent);
      user.knownDevices = [deviceId];
    } else {
      user.knownDevices = [];
    }

    const result: DatabaseUser = await UserModel.create(user);

    if (!result) {
      throw Error('Failed to create user');
    }

    // Remove password field from returned object
    const safeUser: SafeDatabaseUser = {
      _id: result._id,
      username: result.username,
      email: result.email,
      dateJoined: result.dateJoined,
      biography: result.biography,
      followers: [],
      following: [],
      knownDevices: result.knownDevices || [],
      isGoogleSSO: true,
    };

    return safeUser;
  } catch (error) {
    return { error: `Error occurred when saving user: ${error}` };
  }
};

/**
 * Retrieves a user from the database by their username.
 *
 * @param {string} username - The username of the user to find.
 * @returns {Promise<UserResponse>} - Resolves with the found user object (without the password) or an error message.
 */
export const getUserByUsername = async (username: string): Promise<UserResponse> => {
  try {
    const user: SafeDatabaseUser | null = await UserModel.findOne({ username }).select('-password');

    if (!user) {
      throw Error('User not found');
    }

    return user;
  } catch (error) {
    return { error: `Error occurred when finding user: ${error}` };
  }
};

/**
 * Retrieves a user from the database by their email.
 *
 * @param {string} email - The email of the user to find.
 * @returns {Promise<UserResponse>} - Resolves with the found user object (without the password) or an error message.
 */
export const getUserByEmail = async (email: string): Promise<UserResponse> => {
  try {
    const user: SafeDatabaseUser | null = await UserModel.findOne({ email }).select('-password');

    if (!user) {
      throw Error('User not found');
    }

    return user;
  } catch (error) {
    return { error: `Error occurred when finding user by email: ${error}` };
  }
};

/**
 * Retrieves all users from the database.
 * Users documents are returned in the order in which they were created, oldest to newest.
 *
 * @returns {Promise<UsersResponse>} - Resolves with the found user objects (without the passwords) or an error message.
 */
export const getUsersList = async (): Promise<UsersResponse> => {
  try {
    const users: SafeDatabaseUser[] = await UserModel.find().select('-password');

    if (!users) {
      throw Error('Users could not be retrieved');
    }

    return users;
  } catch (error) {
    return { error: `Error occurred when finding users: ${error}` };
  }
};

/**
 * Authenticates a user by verifying their username and password.
 *
 * @param {UserCredentials} loginCredentials - An object containing the username and password.
 * @param {string} ip - The IP address of the device attempting login.
 * @param {string} userAgent - The user-agent string of the device/browser.
 * @returns {Promise<UserResponse>} - Resolves with the authenticated user object (without the password) or an error message.
 */
export const loginUser = async (
  loginCredentials: UserCredentials,
  ip?: string,
  userAgent?: string,
): Promise<UserResponse> => {
  const { username, password } = loginCredentials;

  try {
    const user = await UserModel.findOne({ $or: [{ username }, { email: username }] });
    if (!user) throw new Error('Authentication failed');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Authentication failed');

    if (ip && userAgent) {
      const deviceId = getDeviceId(ip, userAgent);
      const knownDevices = user.knownDevices || [];
      if (!knownDevices.includes(deviceId)) {
        await UserModel.findOneAndUpdate({ _id: user._id }, { $push: { knownDevices: deviceId } });
        await sendNewDeviceEmail(user.email, user.username);
      }
    }

    return user;
  } catch (error) {
    return { error: `Error occurred when authenticating user: ${error}` };
  }
};

/**
 * Deletes a user from the database by their username.
 *
 * @param {string} username - The username of the user to delete.
 * @returns {Promise<UserResponse>} - Resolves with the deleted user object (without the password) or an error message.
 */
export const deleteUserByUsername = async (username: string): Promise<UserResponse> => {
  try {
    const deletedUser: SafeDatabaseUser | null = await UserModel.findOneAndDelete({
      username,
    }).select('-password');

    if (!deletedUser) {
      throw Error('Error deleting user');
    }

    return deletedUser;
  } catch (error) {
    return { error: `Error occurred when finding user: ${error}` };
  }
};

/**
 * Updates user information in the database.
 *
 * @param {string} username - The username of the user to update.
 * @param {Partial<User>} updates - An object containing the fields to update and their new values.
 * @returns {Promise<UserResponse>} - Resolves with the updated user object (without the password) or an error message.
 */
export const updateUser = async (
  username: string,
  updates: Partial<User>,
): Promise<UserResponse> => {
  try {
    const updatedUser: SafeDatabaseUser | null = await UserModel.findOneAndUpdate(
      { username },
      { $set: updates },
      { new: true },
    ).select('-password');

    if (!updatedUser) {
      throw Error('Error updating user');
    }

    return updatedUser;
  } catch (error) {
    return { error: `Error occurred when updating user: ${error}` };
  }
};

/**
 * Toggles the follow status between two users.
 * If the current user is following the target user, they will unfollow.
 * If the current user is not following the target user, they will follow.
 *
 * @param {string} currentUsername - The username of the user performing the action.
 * @param {string} targetUsername - The username of the user to follow/unfollow.
 * @returns {Promise<UserResponse>} - Resolves with the updated current user object or an error message.
 */
export const toggleFollowUser = async (
  currentUsername: string,
  targetUsername: string,
): Promise<UserResponse> => {
  try {
    // Prevent users from following themselves
    if (currentUsername === targetUsername) {
      throw Error('Cannot follow yourself');
    }

    const currentUser: DatabaseUser | null = await UserModel.findOne({ username: currentUsername });
    const targetUser: DatabaseUser | null = await UserModel.findOne({ username: targetUsername });

    if (!currentUser || !targetUser) {
      throw Error('User not found');
    }

    const isFollowing = currentUser.following.some(
      id => id.toString() === targetUser._id.toString(),
    );

    if (isFollowing) {
      // Unfollow: Remove targetUser from currentUser's following
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== targetUser._id.toString(),
      );

      // Remove currentUser from targetUser's followers
      targetUser.followers = targetUser.followers.filter(
        id => id.toString() !== currentUser._id.toString(),
      );
    } else {
      // Follow: Add targetUser to currentUser's following
      currentUser.following.push(targetUser._id);

      // Add currentUser to targetUser's followers
      targetUser.followers.push(currentUser._id);
    }

    // Saved changes to the database for both users using findByIdAndUpdate
    const savedCurrent = await UserModel.findByIdAndUpdate(
      currentUser._id,
      { followers: currentUser.followers, following: currentUser.following },
      { new: true },
    ).select('-password');

    await UserModel.findByIdAndUpdate(
      targetUser._id,
      { followers: targetUser.followers, following: targetUser.following },
      { new: true },
    ).select('-password');

    if (!savedCurrent) {
      throw Error('Error persisting follow changes for current user');
    }

    // Return safe user without password
    const safeUser: SafeDatabaseUser = {
      _id: savedCurrent._id,
      username: savedCurrent.username,
      email: savedCurrent.email,
      dateJoined: savedCurrent.dateJoined,
      biography: savedCurrent.biography,
      followers: savedCurrent.followers,
      following: savedCurrent.following,
      isGoogleSSO: true,
    };

    return safeUser;
  } catch (error) {
    return { error: `Error occurred when toggling follow: ${error}` };
  }
};

/**
 * Retrieves the list of followers for a specific user.
 *
 * @param {string} username - The username of the user whose followers to retrieve.
 * @returns {Promise<UsersResponse>} - Resolves with an array of follower user objects or an error message.
 */
export const getFollowers = async (username: string): Promise<UsersResponse> => {
  try {
    const user = await UserModel.findOne({ username }).populate<{ followers: SafeDatabaseUser[] }>(
      'followers',
      '-password',
    );

    if (!user) {
      throw Error('User not found');
    }

    return user.followers;
  } catch (error) {
    return { error: `Error occurred when fetching followers: ${error}` };
  }
};

/**
 * Retrieves the list of users that a specific user is following.
 *
 * @param {string} username - The username of the user whose following list to retrieve.
 * @returns {Promise<UsersResponse>} - Resolves with an array of following user objects or an error message.
 */
export const getFollowing = async (username: string): Promise<UsersResponse> => {
  try {
    const user = await UserModel.findOne({ username }).populate<{ following: SafeDatabaseUser[] }>(
      'following',
      '-password',
    );

    if (!user) {
      throw Error('User not found');
    }

    return user.following;
  } catch (error) {
    return { error: `Error occurred when fetching following: ${error}` };
  }
};

/**
 * Updates the allowOpenMessaging setting for a user
 *
 * @param username - The username of the user
 * @param allowOpenMessaging - The new setting value
 * @returns Promise<UserResponse>
 */
export const updateMessagingSetting = async (
  username: string,
  allowOpenMessaging: boolean,
): Promise<UserResponse> => {
  try {
    const updatedUser = await UserModel.findOneAndUpdate(
      { username },
      { $set: { allowOpenMessaging } },
      { new: true },
    ).select('-password');

    if (!updatedUser) {
      throw Error('Error updating messaging setting');
    }

    return updatedUser;
  } catch (error) {
    return { error: `Error occurred when updating messaging setting: ${error}` };
  }
};

/**
 * Generates a 2FA secret for a user
 *
 * @param username - The username of the user
 * @returns Object containing the secret and QR code URL
 */
export const generate2FASecret = async (username: string) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `CodeStack (${username})`,
      length: 32,
    });

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  } catch (error) {
    throw new Error('Error generating 2FA secret');
  }
};

/**
 * Enables 2FA for a user after verifying the token
 *
 * @param username - The username of the user
 * @param secret - The 2FA secret
 * @param token - The 6-digit token from authenticator app
 * @returns Promise<UserResponse>
 */
export const enable2FA = async (
  username: string,
  secret: string,
  token: string,
): Promise<UserResponse> => {
  try {
    // Verify the token first
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
    });

    if (!verified) {
      throw new Error('Invalid token');
    }

    // Update user with 2FA enabled and save secret
    const updatedUser = await UserModel.findOneAndUpdate(
      { username },
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
        },
      },
      { new: true },
    ).select('-password -twoFactorSecret');

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    return { error: `Error enabling 2FA: ${error}` };
  }
};

/**
 * Disables 2FA for a user
 *
 * @param username - The username of the user
 * @returns Promise<UserResponse>
 */
export const disable2FA = async (username: string): Promise<UserResponse> => {
  try {
    const updatedUser = await UserModel.findOneAndUpdate(
      { username },
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      },
      { new: true },
    ).select('-password -twoFactorSecret');

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    return { error: `Error disabling 2FA: ${error}` };
  }
};

/**
 * Verifies a 2FA token
 *
 * @param username - The username of the user
 * @param token - The 6-digit token from authenticator app
 * @returns boolean - true if valid
 */
export const verify2FAToken = async (username: string, token: string): Promise<boolean> => {
  try {
    const user = await UserModel.findOne({ username });

    if (!user || !user.twoFactorSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
    });
  } catch (error) {
    return false;
  }
};

/**
 * Generates a unique device identifier based on the user's IP address and user-agent.
 * This function creates a SHA-256 hash of the combination of the IP address and user-agent
 * string. It can be used to detect whether a user is signing in from a new device.
 *
 * @param ip - The IP address of the device (usually from the request object).
 * @param userAgent - The user-agent string from the browser or client.
 * @returns A SHA-256 hash string representing a unique device identifier.
 */
export const getDeviceId = (ip: string, userAgent: string): string => {
  return crypto
    .createHash('sha256')
    .update(ip + userAgent)
    .digest('hex');
};

/**
 * Sends an email notification to a user when a sign-in is detected from a new device.
 * Uses SMTP2GO via standard SMTP credentials.
 *
 * @param to - The recipient's email address.
 * @param username - The recipient's username.
 */
export const sendNewDeviceEmail = async (to: string, username: string) => {
  try {
    const payload = {
      service_id: process.env.EMAILJS_SERVICEID,
      template_id: process.env.EMAILJS_TEMPLATEID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      template_params: {
        email: to,
        user: username,
      },
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Error sending email: ${errorText}` };
    }

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      return { error: `Error sending email: ${err.message}` };
    }
    return { error: 'Unknown error sending email' };
  }
};
