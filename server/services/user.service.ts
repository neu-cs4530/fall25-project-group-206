import UserModel from '../models/users.model';
import {
  DatabaseUser,
  SafeDatabaseUser,
  User,
  UserCredentials,
  UserResponse,
  UsersResponse,
} from '../types/types';

/**
 * Saves a new user to the database.
 *
 * @param {User} user - The user object to be saved, containing user details like username, password, etc.
 * @returns {Promise<UserResponse>} - Resolves with the saved user object (without the password) or an error message.
 */
export const saveUser = async (user: User): Promise<UserResponse> => {
  try {
    const result: DatabaseUser = await UserModel.create(user);

    if (!result) {
      throw Error('Failed to create user');
    }

    // Remove password field from returned object
    const safeUser: SafeDatabaseUser = {
      _id: result._id,
      username: result.username,
      dateJoined: result.dateJoined,
      biography: result.biography,
      followers: [],
      following: [],
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
 * @returns {Promise<UserResponse>} - Resolves with the authenticated user object (without the password) or an error message.
 */
export const loginUser = async (loginCredentials: UserCredentials): Promise<UserResponse> => {
  const { username, password } = loginCredentials;

  try {
    const user: SafeDatabaseUser | null = await UserModel.findOne({ username, password }).select(
      '-password',
    );

    if (!user) {
      throw Error('Authentication failed');
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

    const isFollowing = currentUser.following.includes(targetUser._id);

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
      dateJoined: savedCurrent.dateJoined,
      biography: savedCurrent.biography,
      followers: savedCurrent.followers,
      following: savedCurrent.following,
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
