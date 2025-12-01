import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app';
import * as util from '../../services/user.service';
import { SafeDatabaseUser, User } from '../../types/types';
import NotificationModel from '../../models/notification.model';
import bcrypt from 'bcrypt';

jest.mock('../../utils/realtime', () => {
  const emitMock = jest.fn();
  const registerSocketServerMock = jest.fn();

  return {
    __esModule: true,
    default: emitMock, // what you import as emitNotification
    registerSocketServer: registerSocketServerMock, // what app.ts calls
  };
});

import emitNotification from '../../utils/realtime';

const mockUser: User = {
  username: 'user1',
  password: 'password',
  email: 'testemail@gmail.com',
  dateJoined: new Date('2024-12-03'),
  followers: [],
  following: [],
  isGoogleSSO: true,
};

const mockSafeUser: SafeDatabaseUser = {
  _id: new mongoose.Types.ObjectId(),
  username: 'user1',
  email: 'testemail@gmail.com',
  dateJoined: new Date('2024-12-03'),
  followers: [],
  following: [],
  isGoogleSSO: true,
};

const mockUserJSONResponse = {
  _id: mockSafeUser._id.toString(),
  username: 'user1',
  email: 'testemail@gmail.com',
  dateJoined: new Date('2024-12-03').toISOString(),
  followers: [],
  following: [],
  isGoogleSSO: true,
};

const saveUserSpy = jest.spyOn(util, 'saveUser');
const loginUserSpy = jest.spyOn(util, 'loginUser');
const updatedUserSpy = jest.spyOn(util, 'updateUser');
const getUserByUsernameSpy = jest.spyOn(util, 'getUserByUsername');
const getUsersListSpy = jest.spyOn(util, 'getUsersList');
const deleteUserByUsernameSpy = jest.spyOn(util, 'deleteUserByUsername');
const toggleFollowSpy = jest.spyOn(util, 'toggleFollowUser');
const getFollowersSpy = jest.spyOn(util, 'getFollowers');
const getFollowingSpy = jest.spyOn(util, 'getFollowing');
const generate2FASecretSpy = jest.spyOn(util, 'generate2FASecret');
const enable2FASpy = jest.spyOn(util, 'enable2FA');
const disable2FASpy = jest.spyOn(util, 'disable2FA');
const verify2FATokenSpy = jest.spyOn(util, 'verify2FAToken');

describe('Test userController', () => {
  describe('POST /signup', () => {
    it('should create a new user given correct arguments', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: mockUser.password,
        biography: 'This is a test biography',
      };

      saveUserSpy.mockResolvedValueOnce({ ...mockSafeUser, biography: mockReqBody.biography });

      const response = await supertest(app).post('/api/user/signup').send(mockReqBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...mockUserJSONResponse, biography: mockReqBody.biography });
      expect(saveUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockReqBody,
          biography: mockReqBody.biography,
          dateJoined: expect.any(Date),
          followers: [],
          following: [],
        }),
        expect.any(String), // IP
        expect.any(String), // User-Agent
      );
    });

    it('should return 400 for request missing username', async () => {
      const mockReqBody = {
        password: mockUser.password,
      };

      const response = await supertest(app).post('/api/user/signup').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request with empty username', async () => {
      const mockReqBody = {
        username: '',
        password: mockUser.password,
      };

      const response = await supertest(app).post('/api/user/signup').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request missing password', async () => {
      const mockReqBody = {
        username: mockUser.username,
      };

      const response = await supertest(app).post('/api/user/signup').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/password');
    });

    it('should return 400 for request with empty password', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: '',
      };

      const response = await supertest(app).post('/api/user/signup').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/password');
    });

    it('should return 500 for a database error while saving', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: mockUser.password,
      };

      saveUserSpy.mockResolvedValueOnce({ error: 'Error saving user' });

      const response = await supertest(app).post('/api/user/signup').send(mockReqBody);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /login', () => {
    it('should succesfully login for a user given correct arguments', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: mockUser.password,
      };

      loginUserSpy.mockResolvedValueOnce(mockSafeUser);

      const response = await supertest(app).post('/api/user/login').send(mockReqBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserJSONResponse);
      expect(loginUserSpy).toHaveBeenCalledWith(
        mockReqBody,
        expect.any(String), // IP
        expect.any(String), // User-Agent
      );
    });

    it('should return 400 for request missing username', async () => {
      const mockReqBody = {
        password: mockUser.password,
      };

      const response = await supertest(app).post('/api/user/login').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request with empty username', async () => {
      const mockReqBody = {
        username: '',
        password: mockUser.password,
      };

      const response = await supertest(app).post('/api/user/login').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request missing password', async () => {
      const mockReqBody = {
        username: mockUser.username,
      };

      const response = await supertest(app).post('/api/user/login').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/password');
    });

    it('should return 400 for request with empty password', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: '',
      };

      const response = await supertest(app).post('/api/user/login').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/password');
    });

    it('should return 500 for a database error while saving', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: mockUser.password,
      };

      loginUserSpy.mockResolvedValueOnce({ error: 'Error authenticating user' });

      const response = await supertest(app).post('/api/user/login').send(mockReqBody);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /resetPassword', () => {
    it('should succesfully return updated user object given correct arguments', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: 'newPassword',
      };

      updatedUserSpy.mockResolvedValueOnce(mockSafeUser);

      const response = await supertest(app).patch('/api/user/resetPassword').send(mockReqBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...mockUserJSONResponse });
      const updateObject = updatedUserSpy.mock.calls[0][1];
      const hashedPassword = updateObject.password;
      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe('string');
      const matches = await bcrypt.compare('newPassword', hashedPassword as string);
      expect(matches).toBe(true);
    });

    it('should return 400 for request missing username', async () => {
      const mockReqBody = {
        password: 'newPassword',
      };

      const response = await supertest(app).patch('/api/user/resetPassword').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request with empty username', async () => {
      const mockReqBody = {
        username: '',
        password: 'newPassword',
      };

      const response = await supertest(app).patch('/api/user/resetPassword').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request missing password', async () => {
      const mockReqBody = {
        username: mockUser.username,
      };

      const response = await supertest(app).patch('/api/user/resetPassword').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/password');
    });

    it('should return 400 for request with empty password', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: '',
      };

      const response = await supertest(app).patch('/api/user/resetPassword').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/password');
    });

    it('should return 500 for a database error while updating', async () => {
      const mockReqBody = {
        username: mockUser.username,
        password: 'newPassword',
      };

      updatedUserSpy.mockResolvedValueOnce({ error: 'Error updating user' });

      const response = await supertest(app).patch('/api/user/resetPassword').send(mockReqBody);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /getUser', () => {
    it('should return the user given correct arguments', async () => {
      getUserByUsernameSpy.mockResolvedValueOnce(mockSafeUser);

      const response = await supertest(app).get(`/api/user/getUser/${mockUser.username}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserJSONResponse);
      expect(getUserByUsernameSpy).toHaveBeenCalledWith(mockUser.username);
    });

    it('should return 500 if database error while searching username', async () => {
      getUserByUsernameSpy.mockResolvedValueOnce({ error: 'Error finding user' });

      const response = await supertest(app).get(`/api/user/getUser/${mockUser.username}`);

      expect(response.status).toBe(500);
    });

    it('should return 404 if username not provided', async () => {
      // Express automatically returns 404 for missing parameters when
      // defined as required in the route
      const response = await supertest(app).get('/api/user/getUser/');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /getUsers', () => {
    it('should return the users from the database', async () => {
      getUsersListSpy.mockResolvedValueOnce([mockSafeUser]);

      const response = await supertest(app).get(`/api/user/getUsers`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockUserJSONResponse]);
      expect(getUsersListSpy).toHaveBeenCalled();
    });

    it('should return 500 if database error while finding users', async () => {
      getUsersListSpy.mockResolvedValueOnce({ error: 'Error finding users' });

      const response = await supertest(app).get(`/api/user/getUsers`);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /deleteUser', () => {
    it('should return the deleted user given correct arguments', async () => {
      deleteUserByUsernameSpy.mockResolvedValueOnce(mockSafeUser);

      const response = await supertest(app).delete(`/api/user/deleteUser/${mockUser.username}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserJSONResponse);
      expect(deleteUserByUsernameSpy).toHaveBeenCalledWith(mockUser.username);
    });

    it('should return 500 if database error while searching username', async () => {
      deleteUserByUsernameSpy.mockResolvedValueOnce({ error: 'Error deleting user' });

      const response = await supertest(app).delete(`/api/user/deleteUser/${mockUser.username}`);

      expect(response.status).toBe(500);
    });

    it('should return 404 if username not provided', async () => {
      // Express automatically returns 404 for missing parameters when
      // defined as required in the route
      const response = await supertest(app).delete('/api/user/deleteUser/');
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /updateBiography', () => {
    it('should successfully update biography given correct arguments', async () => {
      const mockReqBody = {
        username: mockUser.username,
        biography: 'This is my new bio',
      };

      // Mock a successful updateUser call
      updatedUserSpy.mockResolvedValueOnce(mockSafeUser);

      const response = await supertest(app).patch('/api/user/updateBiography').send(mockReqBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserJSONResponse);
      // Ensure updateUser is called with the correct args
      expect(updatedUserSpy).toHaveBeenCalledWith(mockUser.username, {
        biography: 'This is my new bio',
      });
    });

    it('should return 400 for request missing username', async () => {
      const mockReqBody = {
        biography: 'some new biography',
      };

      const response = await supertest(app).patch('/api/user/updateBiography').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request with empty username', async () => {
      const mockReqBody = {
        username: '',
        biography: 'a new bio',
      };

      const response = await supertest(app).patch('/api/user/updateBiography').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/username');
    });

    it('should return 400 for request missing biography field', async () => {
      const mockReqBody = {
        username: mockUser.username,
      };

      const response = await supertest(app).patch('/api/user/updateBiography').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/biography');
    });

    it('should return 500 if updateUser returns an error', async () => {
      const mockReqBody = {
        username: mockUser.username,
        biography: 'Attempting update biography',
      };

      // Simulate a DB error
      updatedUserSpy.mockResolvedValueOnce({ error: 'Error updating user' });

      const response = await supertest(app).patch('/api/user/updateBiography').send(mockReqBody);

      expect(response.status).toBe(500);
      expect(response.text).toContain(
        'Error when updating user biography: Error: Error updating user',
      );
    });
  });

  describe('POST /toggleFollow', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully toggle follow status given correct arguments', async () => {
      const currentId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();

      // "Before" state: user1 is NOT following user2
      const currentBefore: any = {
        _id: currentId,
        username: 'user1',
        followers: [],
        following: [],
      };

      const targetUser: any = {
        _id: targetId,
        username: 'user2',
        followers: [],
        following: [],
      };

      // Controller calls getUserByUsername twice: current user, then target user
      getUserByUsernameSpy.mockResolvedValueOnce(currentBefore).mockResolvedValueOnce(targetUser);

      // Then calls toggleFollowUser to actually change relationship
      toggleFollowSpy.mockResolvedValueOnce({
        ...currentBefore,
        following: [targetId], // now following target
      } as any);

      // New follow → should create a notification and emit a ping
      const createSpy = jest.spyOn(NotificationModel, 'create').mockResolvedValueOnce({} as any);
      const emitSpy = emitNotification as jest.Mock;

      const res = await supertest(app)
        .post('/api/user/toggleFollow')
        .send({ currentUsername: 'user1', targetUsername: 'user2' });

      expect(res.status).toBe(200);
      expect(toggleFollowSpy).toHaveBeenCalledWith('user1', 'user2');

      // Notification doc content
      expect(createSpy).toHaveBeenCalledTimes(1);
      const doc = createSpy.mock.calls[0][0] as {
        user: string;
        actor: string;
        targetType: string;
        category: string;
        location: string;
        link: string;
      };

      expect(doc.user).toBe('user2'); // recipient = user being followed
      expect(doc.actor).toBe('user1'); // actor = follower
      expect(doc.targetType).toBe('User');
      expect(doc.category).toBe('follow');
      expect(doc.location).toBe('following');
      expect(doc.link).toBe('/user/user1');

      // Realtime ping to target user
      expect(emitSpy).toHaveBeenCalledWith('user2');
    });

    it('should return 400 for request missing currentUsername', async () => {
      const mockReqBody = {
        targetUsername: 'user2',
      };

      const response = await supertest(app).post('/api/user/toggleFollow').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/currentUsername');
    });

    it('should return 400 for request missing targetUsername', async () => {
      const mockReqBody = {
        currentUsername: 'user1',
      };

      const response = await supertest(app).post('/api/user/toggleFollow').send(mockReqBody);

      const openApiError = JSON.parse(response.text);

      expect(response.status).toBe(400);
      expect(openApiError.errors[0].path).toBe('/body/targetUsername');
    });

    it('should return 500 if toggleFollowUser returns an error', async () => {
      const currentId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();

      const currentBefore: any = {
        _id: currentId,
        username: 'user1',
        followers: [],
        following: [],
      };

      const targetUser: any = {
        _id: targetId,
        username: 'user2',
        followers: [],
        following: [],
      };

      getUserByUsernameSpy.mockResolvedValueOnce(currentBefore).mockResolvedValueOnce(targetUser);

      // Simulate service-level failure
      toggleFollowSpy.mockResolvedValueOnce({
        error: 'Error occurred when toggling follow',
      } as any);

      const createSpy = jest.spyOn(NotificationModel, 'create');

      const res = await supertest(app)
        .post('/api/user/toggleFollow')
        .send({ currentUsername: 'user1', targetUsername: 'user2' });

      // Controller should surface as 500
      expect(res.status).toBe(500);

      // No follow notification should be created on error
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('GET /getFollowers/:username', () => {
    it('should successfully get followers given correct arguments', async () => {
      const mockFollowers = [mockSafeUser];

      // Mock a successful getFollowers call
      getFollowersSpy.mockResolvedValueOnce(mockFollowers);

      const response = await supertest(app).get(`/api/user/${mockUser.username}/followers`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockUserJSONResponse]);
      // Ensure getFollowers is called with the correct args
      expect(getFollowersSpy).toHaveBeenCalledWith(mockUser.username);
    });

    it('should return 500 if getFollowers returns an error', async () => {
      // Simulate a DB error
      getFollowersSpy.mockResolvedValueOnce({ error: 'Error getting followers' });
      const response = await supertest(app).get(`/api/user/${mockUser.username}/followers`);

      expect(response.status).toBe(500);
      expect(response.text).toContain(
        'Error when getting followers: Error: Error getting followers',
      );
    });
  });

  describe('GET /getFollowing/:username', () => {
    it('should successfully get following given correct arguments', async () => {
      const mockFollowing = [mockSafeUser];

      // Mock a successful getFollowing call
      getFollowingSpy.mockResolvedValueOnce(mockFollowing);

      const response = await supertest(app).get(`/api/user/${mockUser.username}/following`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockUserJSONResponse]);
      // Ensure getFollowing is called with the correct args
      expect(getFollowingSpy).toHaveBeenCalledWith(mockUser.username);
    });

    it('should return 500 if getFollowing returns an error', async () => {
      // Simulate a DB error
      getFollowingSpy.mockResolvedValueOnce({ error: 'Error getting following' });
      const response = await supertest(app).get(`/api/user/${mockUser.username}/following`);

      expect(response.status).toBe(500);
      expect(response.text).toContain(
        'Error when getting following: Error: Error getting following',
      );
    });
  });

  describe('PATCH /updateMessagingSetting', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should update allowOpenMessaging: true and call updateUser once with correct args', async () => {
      const body = { username: mockUser.username, allowOpenMessaging: true };
      updatedUserSpy.mockResolvedValueOnce({ ...mockSafeUser, allowOpenMessaging: true } as any);

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ...mockUserJSONResponse, allowOpenMessaging: true });
      expect(updatedUserSpy).toHaveBeenCalledTimes(1);
      expect(updatedUserSpy).toHaveBeenCalledWith(mockUser.username, { allowOpenMessaging: true });
    });

    it('should update allowOpenMessaging: false and call updateUser once with correct args', async () => {
      const body = { username: mockUser.username, allowOpenMessaging: false };
      updatedUserSpy.mockResolvedValueOnce({ ...mockSafeUser, allowOpenMessaging: false } as any);

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ...mockUserJSONResponse, allowOpenMessaging: false });
      expect(updatedUserSpy).toHaveBeenCalledTimes(1);
      expect(updatedUserSpy).toHaveBeenCalledWith(mockUser.username, { allowOpenMessaging: false });
    });

    it('should return 400 for request missing username and NOT call updateUser', async () => {
      const body = { allowOpenMessaging: true };

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(400);
      expect(updatedUserSpy).not.toHaveBeenCalled();
    });

    it('should return 400 for empty username and NOT call updateUser', async () => {
      const body = { username: '', allowOpenMessaging: true };

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(400);
      expect(updatedUserSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when allowOpenMessaging is missing and NOT call updateUser', async () => {
      const body = { username: mockUser.username };

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(400);
      expect(updatedUserSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when allowOpenMessaging is non-boolean and NOT call updateUser', async () => {
      const body: any = { username: mockUser.username, allowOpenMessaging: 'yes' };

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(400);
      expect(updatedUserSpy).not.toHaveBeenCalled();
    });

    it('should return 500 if updateUser returns an error', async () => {
      const body = { username: mockUser.username, allowOpenMessaging: true };
      updatedUserSpy.mockResolvedValueOnce({ error: 'Error updating user' } as any);

      const res = await supertest(app).patch('/api/user/updateMessagingSetting').send(body);

      expect(res.status).toBe(500);
      expect(res.text).toContain(
        'Error when updating messaging setting: Error: Error updating user',
      );
      expect(updatedUserSpy).toHaveBeenCalledTimes(1);
      expect(updatedUserSpy).toHaveBeenCalledWith(mockUser.username, { allowOpenMessaging: true });
    });
  });

  describe('2FA endpoints', () => {
    const username = mockUser.username;

    beforeEach(() => {
      jest.resetAllMocks();
    });

    describe('POST /api/user/2fa/generate', () => {
      it('should generate a 2FA secret and QR code', async () => {
        const payload = { secret: 'BASE32SECRET', qrCode: 'data:image/png;base64,abc' };
        generate2FASecretSpy.mockResolvedValueOnce(payload);

        const res = await supertest(app).post('/api/user/2fa/generate').send({ username });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(payload);
        expect(generate2FASecretSpy).toHaveBeenCalledWith(username);
      });

      it('should return 500 when generation fails', async () => {
        generate2FASecretSpy.mockRejectedValueOnce(new Error('gen-fail'));

        const res = await supertest(app).post('/api/user/2fa/generate').send({ username });

        expect(res.status).toBe(500);
        expect(res.text).toContain('Error generating 2FA');
      });
    });

    it('should return 400 when username is missing for 2FA generate', async () => {
      const res = await supertest(app).post('/api/user/2fa/generate').send({});

      expect(res.status).toBe(400);

      const openApiError = JSON.parse(res.text);
      expect(openApiError.message).toBe('Request Validation Failed');
      expect(openApiError.errors[0].path).toBe('/body/username');

      expect(generate2FASecretSpy).not.toHaveBeenCalled();
    });

    describe('POST /api/user/2fa/enable', () => {
      it('should enable 2FA and return updated user', async () => {
        const updated = { ...mockSafeUser, twoFactorEnabled: true };
        enable2FASpy.mockResolvedValueOnce(updated);

        const res = await supertest(app)
          .post('/api/user/2fa/enable')
          .send({ username, secret: 'BASE32SECRET', token: '123456' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          ...mockUserJSONResponse,
          twoFactorEnabled: true,
        });
        expect(enable2FASpy).toHaveBeenCalledWith(username, 'BASE32SECRET', '123456');
      });

      it('should return 500 when service returns error', async () => {
        enable2FASpy.mockResolvedValueOnce({ error: 'Invalid token' } as any);

        const res = await supertest(app)
          .post('/api/user/2fa/enable')
          .send({ username, secret: 'BASE32SECRET', token: '000000' });

        expect(res.status).toBe(500);
        expect(res.text).toContain('Error');
      });
    });

    describe('POST /api/user/2fa/disable', () => {
      it('should disable 2FA and return updated user', async () => {
        const updated = { ...mockSafeUser, twoFactorEnabled: false };
        disable2FASpy.mockResolvedValueOnce(updated);

        const res = await supertest(app).post('/api/user/2fa/disable').send({ username });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          ...mockUserJSONResponse,
          twoFactorEnabled: false,
        });
        expect(disable2FASpy).toHaveBeenCalledWith(username);
      });

      it('should return 500 when service returns error', async () => {
        disable2FASpy.mockResolvedValueOnce({ error: 'User not found' } as any);

        const res = await supertest(app).post('/api/user/2fa/disable').send({ username });

        expect(res.status).toBe(500);
        expect(res.text).toContain('Error disabling 2FA');
      });
    });

    describe('POST /api/user/2fa/verify', () => {
      it('should return valid: true when token is correct', async () => {
        verify2FATokenSpy.mockResolvedValueOnce(true);

        const res = await supertest(app)
          .post('/api/user/2fa/verify')
          .send({ username, token: '123456' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ valid: true });
        expect(verify2FATokenSpy).toHaveBeenCalledWith(username, '123456');
      });

      it('should return valid: false when token is incorrect', async () => {
        verify2FATokenSpy.mockResolvedValueOnce(false);

        const res = await supertest(app)
          .post('/api/user/2fa/verify')
          .send({ username, token: '000000' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ valid: false });
        expect(verify2FATokenSpy).toHaveBeenCalledWith(username, '000000');
      });

      it('should return 500 if verification throws', async () => {
        verify2FATokenSpy.mockRejectedValueOnce(new Error('verify-crash'));

        const res = await supertest(app)
          .post('/api/user/2fa/verify')
          .send({ username, token: '111111' });

        expect(res.status).toBe(500);
        expect(res.text).toContain('Error verifying 2FA');
      });
    });

    describe('PATCH /updateGoogleSSOSetting', () => {
      beforeEach(() => {
        jest.resetAllMocks();
      });

      it('should successfully update Google SSO setting and call updateUser with correct args', async () => {
        const body = { username: mockUser.username, isGoogleSSO: false };

        updatedUserSpy.mockResolvedValueOnce({ ...mockSafeUser, isGoogleSSO: false } as any);

        const res = await supertest(app).patch('/api/user/updateGoogleSSOSetting').send(body);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ...mockUserJSONResponse, isGoogleSSO: false });
        expect(updatedUserSpy).toHaveBeenCalledTimes(1);
        expect(updatedUserSpy).toHaveBeenCalledWith(mockUser.username, { isGoogleSSO: false });
      });

      it('should return 400 when username is missing and NOT call updateUser', async () => {
        const body = { isGoogleSSO: true };

        const res = await supertest(app).patch('/api/user/updateGoogleSSOSetting').send(body);

        expect(res.status).toBe(400);
        expect(res.text).toContain('Invalid username or isGoogleSSO');
        expect(updatedUserSpy).not.toHaveBeenCalled();
      });

      it('should return 400 when isGoogleSSO is not a boolean and NOT call updateUser', async () => {
        const body: any = { username: mockUser.username, isGoogleSSO: 'yes' };

        const res = await supertest(app).patch('/api/user/updateGoogleSSOSetting').send(body);

        expect(res.status).toBe(400);
        expect(res.text).toContain('Invalid username or isGoogleSSO');
        expect(updatedUserSpy).not.toHaveBeenCalled();
      });

      it('should return 400 when disabling SSO for a Google-based account (username contains "@")', async () => {
        const body = { username: 'user@gmail.com', isGoogleSSO: false };

        const res = await supertest(app).patch('/api/user/updateGoogleSSOSetting').send(body);

        expect(res.status).toBe(400);
        expect(res.text).toContain(
          'Google SSO cannot be disabled for accounts created with Google login.',
        );
        expect(updatedUserSpy).not.toHaveBeenCalled();
      });

      it('should return 500 when updateUser returns an error', async () => {
        const body = { username: mockUser.username, isGoogleSSO: false };

        updatedUserSpy.mockResolvedValueOnce({ error: 'Error updating user' } as any);

        const res = await supertest(app).patch('/api/user/updateGoogleSSOSetting').send(body);

        expect(res.status).toBe(500);
        expect(res.text).toContain(
          'Error when updating Google SSO setting: Error: Error updating user',
        );
        expect(updatedUserSpy).toHaveBeenCalledTimes(1);
        expect(updatedUserSpy).toHaveBeenCalledWith(mockUser.username, { isGoogleSSO: false });
      });
    });
  });
});
