import express, { Request, Response, Router } from 'express';
import {
  UserRequest,
  User,
  UserCredentials,
  UserByUsernameRequest,
  FakeSOSocket,
  UpdateBiographyRequest,
} from '../types/types';
import {
  deleteUserByUsername,
  getUserByUsername,
  getUsersList,
  loginUser,
  saveUser,
  updateUser,
  toggleFollowUser,
  getFollowers,
  getFollowing,
  generate2FASecret,
  enable2FA,
  disable2FA,
  verify2FAToken,
} from '../services/user.service';
import NotificationModel from '../models/notification.model';
import emitNotification from '../utils/realtime';
import bcrypt from 'bcrypt';

const userController = (socket: FakeSOSocket) => {
  const router: Router = express.Router();

  /**
   * Handles the creation of a new user account.
   * @param req The request containing username, email, and password in the body.
   * @param res The response, either returning the created user or an error.
   * @returns A promise resolving to void.
   */
  const createUser = async (req: UserRequest, res: Response): Promise<void> => {
    const requestUser = req.body;

    const user: User = {
      ...requestUser,
      dateJoined: new Date(),
      biography: requestUser.biography ?? '',
      followers: [],
      following: [],
      isGoogleSSO: true,
    };

    const ip = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      const result = await saveUser(user, ip, userAgent);

      if ('error' in result) {
        throw new Error(result.error);
      }

      socket.emit('userUpdate', {
        user: result,
        type: 'created',
      });
      res.status(200).json(result);
    } catch (error) {
      res.status(500).send(`Error when saving user: ${error}`);
    }
  };

  /**
   * Handles user login by validating credentials.
   * @param req The request containing username and password in the body.
   * @param res The response, either returning the user or an error.
   * @returns A promise resolving to void.
   */
  const userLogin = async (req: UserRequest, res: Response): Promise<void> => {
    try {
      const loginCredentials: UserCredentials = {
        username: req.body.username,
        password: req.body.password,
      };

      const ip = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const user = await loginUser(loginCredentials, ip, userAgent);

      if ('error' in user) {
        throw Error(user.error);
      }

      res.status(200).json(user);
    } catch (error) {
      res.status(500).send('Login failed');
    }
  };

  /**
   * Retrieves a user by their username.
   * @param req The request containing the username as a route parameter.
   * @param res The response, either returning the user or an error.
   * @returns A promise resolving to void.
   */
  const getUser = async (req: UserByUsernameRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;

      const user = await getUserByUsername(username);

      if ('error' in user) {
        throw Error(user.error);
      }

      res.status(200).json(user);
    } catch (error) {
      res.status(500).send(`Error when getting user by username: ${error}`);
    }
  };

  /**
   * Retrieves all users from the database.
   * @param res The response, either returning the users or an error.
   * @returns A promise resolving to void.
   */
  const getUsers = async (_: Request, res: Response): Promise<void> => {
    try {
      const users = await getUsersList();

      if ('error' in users) {
        throw Error(users.error);
      }

      res.status(200).json(users);
    } catch (error) {
      res.status(500).send(`Error when getting users: ${error}`);
    }
  };

  /**
   * Deletes a user by their username.
   * @param req The request containing the username as a route parameter.
   * @param res The response, either confirming deletion or returning an error.
   * @returns A promise resolving to void.
   */
  const deleteUser = async (req: UserByUsernameRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;

      const deletedUser = await deleteUserByUsername(username);

      if ('error' in deletedUser) {
        throw Error(deletedUser.error);
      }

      socket.emit('userUpdate', {
        user: deletedUser,
        type: 'deleted',
      });
      res.status(200).json(deletedUser);
    } catch (error) {
      res.status(500).send(`Error when deleting user by username: ${error}`);
    }
  };

  /**
   * Resets a user's password.
   * @param req The request containing the username and new password in the body.
   * @param res The response, either confirming the update or returning an error.
   * @returns A promise resolving to void.
   */
  const resetPassword = async (req: UserRequest, res: Response): Promise<void> => {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const updatedUser = await updateUser(req.body.username, { password: hashedPassword });

      if ('error' in updatedUser) {
        throw Error(updatedUser.error);
      }

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`Error when updating user password: ${error}`);
    }
  };

  /**
   * Updates a user's biography.
   * @param req The request containing the username and biography in the body.
   * @param res The response, either confirming the update or returning an error.
   * @returns A promise resolving to void.
   */
  const updateBiography = async (req: UpdateBiographyRequest, res: Response): Promise<void> => {
    try {
      // Validate that request has username and biography
      const { username, biography } = req.body;

      // Call the same updateUser(...) service used by resetPassword
      const updatedUser = await updateUser(username, { biography });

      if ('error' in updatedUser) {
        throw new Error(updatedUser.error);
      }

      // Emit socket event for real-time updates
      socket.emit('userUpdate', {
        user: updatedUser,
        type: 'updated',
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`Error when updating user biography: ${error}`);
    }
  };

  /**
   * Toggles follow/unfollow status between the current user and target user.
   * @param req The request containing currentUsername and targetUsername in the body.
   * @param res The response, either returning the updated user or an error.
   * @returns A promise resolving to void.
   */
  /**
   * Toggles follow/unfollow status between the current user and target user.
   * Also emits a notification when this results in a new follow.
   */
  const toggleFollow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentUsername, targetUsername } = req.body;

      if (!currentUsername || !targetUsername) {
        res.status(400).send('Both currentUsername and targetUsername are required');
        return;
      }

      const [currentBefore, targetUser] = await Promise.all([
        getUserByUsername(currentUsername),
        getUserByUsername(targetUsername),
      ]);

      if ('error' in currentBefore) {
        throw new Error(currentBefore.error);
      }
      if ('error' in targetUser) {
        throw new Error(targetUser.error);
      }

      const wasFollowing = currentBefore.following.some(
        id => id.toString() === targetUser._id.toString(),
      );

      const updatedUser = await toggleFollowUser(currentUsername, targetUsername);

      if ('error' in updatedUser) {
        throw new Error(updatedUser.error);
      }

      // FOLLOW path → create notification, but do it fire-and-forget so we never block the HTTP response.
      if (!wasFollowing) {
        NotificationModel.create({
          user: targetUser.username, // recipient
          actor: currentUsername, // follower
          message: `${currentUsername} started following you`,
          eventDate: new Date(),
          targetId: currentBefore._id, // follower's id as the "target"
          targetType: 'User',
          location: 'following',
          link: `/user/${currentUsername}`,
          category: 'follow',
          isRead: false,
        }).catch(err => {
          // optional: log, but do not rethrow
          // console.error('Error creating follow notification', err);
        });

        // Real-time ping stays synchronous but cheap
        emitNotification(targetUser.username);
      }

      socket.emit('userUpdate', {
        user: updatedUser,
        type: 'updated',
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`Error when toggling follow: ${error}`);
    }
  };

  /**
   * Retrieves the list of followers for a specific user.
   * @param req The request containing the username as a route parameter.
   * @param res The response, either returning the followers list or an error.
   * @returns A promise resolving to void.
   */
  const getUserFollowers = async (req: UserByUsernameRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;

      const followers = await getFollowers(username);

      if ('error' in followers) {
        throw new Error(followers.error);
      }

      res.status(200).json(followers);
    } catch (error) {
      res.status(500).send(`Error when getting followers: ${error}`);
    }
  };

  /**
   * Retrieves the list of users that a specific user is following.
   * @param req The request containing the username as a route parameter.
   * @param res The response, either returning the following list or an error.
   * @returns A promise resolving to void.
   */
  const getUserFollowing = async (req: UserByUsernameRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;

      const following = await getFollowing(username);

      if ('error' in following) {
        throw new Error(following.error);
      }

      res.status(200).json(following);
    } catch (error) {
      res.status(500).send(`Error when getting following: ${error}`);
    }
  };

  /**
   * Toggles open messaging/mutual follow messaging.
   * @param req The request containing the username and boolean in the body.
   * @param res The response, either confirming the update or returning an error.
   * @returns A promise resolving to void.
   */
  const updateMessagingSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, allowOpenMessaging } = req.body;

      if (!username || typeof allowOpenMessaging !== 'boolean' || username == '') {
        res.status(400).send('Invalid username or allowOpenMessaging');
        return;
      }

      const updatedUser = await updateUser(username, { allowOpenMessaging });

      if ('error' in updatedUser) {
        throw new Error(updatedUser.error);
      }

      socket.emit('userUpdate', {
        user: updatedUser,
        type: 'updated',
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`Error when updating messaging setting: ${error}`);
    }
  };

  /**
   * Generates a new Two-Factor Authentication (2FA) secret and QR code for a user.
   * @param req The request containing the username in the body.
   * @param res The response returning the generated secret and QR code or an error.
   * @returns A promise resolving to void.
   */
  const generate2FA = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username } = req.body;

      if (!username) {
        res.status(400).send('Username is required');
        return;
      }

      const result = await generate2FASecret(username);

      res.status(200).json(result);
    } catch (error) {
      res.status(500).send(`Error generating 2FA: ${error}`);
    }
  };

  /**
   * Enables Two-Factor Authentication (2FA) for a user after verifying the provided token.
   * @param req The request containing username, secret, and token in the body.
   * @param res The response returning the updated user or an error.
   * @returns A promise resolving to void.
   */
  const enable2FAEndpoint = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, secret, token } = req.body;

      const updatedUser = await enable2FA(username, secret, token);

      if ('error' in updatedUser) {
        throw new Error(updatedUser.error);
      }

      socket.emit('userUpdate', {
        user: updatedUser,
        type: 'updated',
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`${error}`);
    }
  };

  /**
   * Disables Two-Factor Authentication (2FA) for a user.
   * @param req The request containing the username in the body.
   * @param res The response returning the updated user or an error.
   * @returns A promise resolving to void.
   */
  const disable2FAEndpoint = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username } = req.body;

      const updatedUser = await disable2FA(username);

      if ('error' in updatedUser) {
        throw new Error(updatedUser.error);
      }

      socket.emit('userUpdate', {
        user: updatedUser,
        type: 'updated',
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`Error disabling 2FA: ${error}`);
    }
  };

  /**
   * Verifies a user's 2FA token during login.
   * @param req The request containing the username and token in the body.
   * @param res The response returning a boolean indicating if the token is valid or not.
   * @returns A promise resolving to void.
   */

  const verify2FA = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, token } = req.body;

      const isValid = await verify2FAToken(username, token);

      res.status(200).json({ valid: isValid });
    } catch (error) {
      res.status(500).send(`Error verifying 2FA: ${error}`);
    }
  };

  /**
   * Updates a user's Google SSO setting (enable/disable).
   * Throws an error if a Google-based account attempts to disable SSO.
   * @param req The request containing username and allowGoogleSSO in the body.
   * @param res The response, either confirming the update or returning an error.
   * @returns A promise resolving to void.
   */
  const updateGoogleSSOSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, isGoogleSSO } = req.body;

      if (!username || typeof isGoogleSSO !== 'boolean') {
        res.status(400).send('Invalid username or isGoogleSSO');
        return;
      }

      if (!isGoogleSSO && username.includes('@')) {
        res
          .status(400)
          .send('Google SSO cannot be disabled for accounts created with Google login.');
        return;
      }

      const updatedUser = await updateUser(username, { isGoogleSSO });

      if ('error' in updatedUser) {
        throw new Error(updatedUser.error);
      }

      socket.emit('userUpdate', {
        user: updatedUser,
        type: 'updated',
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send(`Error when updating Google SSO setting: ${error}`);
    }
  };

  router.post('/2fa/generate', generate2FA);
  router.post('/2fa/enable', enable2FAEndpoint);
  router.post('/2fa/disable', disable2FAEndpoint);
  router.post('/2fa/verify', verify2FA);
  router.post('/signup', createUser);
  router.post('/login', userLogin);
  router.patch('/resetPassword', resetPassword);
  router.get('/getUser/:username', getUser);
  router.get('/getUsers', getUsers);
  router.delete('/deleteUser/:username', deleteUser);
  router.patch('/updateBiography', updateBiography);
  router.get('/:username/followers', getUserFollowers);
  router.get('/:username/following', getUserFollowing);
  router.post('/toggleFollow', toggleFollow);
  router.patch('/updateMessagingSetting', updateMessagingSetting);
  router.patch('/updateGoogleSSOSetting', updateGoogleSSOSetting);

  return router;
};

export default userController;
