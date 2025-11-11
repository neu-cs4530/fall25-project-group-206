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
} from '../services/user.service';

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
    };

    try {
      const result = await saveUser(user);

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

      const user = await loginUser(loginCredentials);

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
      const updatedUser = await updateUser(req.body.username, { password: req.body.password });

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
  const toggleFollow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentUsername, targetUsername } = req.body;

      if (!currentUsername || !targetUsername) {
        res.status(400).send('Both currentUsername and targetUsername are required');
        return;
      }

      const updatedUser = await toggleFollowUser(currentUsername, targetUsername);

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
   * Updates a user's biography.
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

  // Define routes for the user-related operations.
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
  return router;
};

export default userController;
