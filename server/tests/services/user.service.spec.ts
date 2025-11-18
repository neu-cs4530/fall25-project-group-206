// server/tests/user.toggleFollow.controller.spec.ts
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

// 1. Mock user.service BEFORE importing the controller
jest.mock('../../services/user.service', () => {
  // We only need the functions used by toggleFollow route; everything can be jest.fn
  return {
    deleteUserByUsername: jest.fn(),
    getUserByUsername: jest.fn(),
    getUsersList: jest.fn(),
    loginUser: jest.fn(),
    saveUser: jest.fn(),
    updateUser: jest.fn(),
    toggleFollowUser: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
    generate2FASecret: jest.fn(),
    enable2FA: jest.fn(),
    disable2FA: jest.fn(),
    verify2FAToken: jest.fn(),
  };
});

// 2. Mock realtime + NotificationModel so tests do not hit sockets or DB
jest.mock('../../utils/realtime', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import emitNotification from '../../utils/realtime';
import NotificationModel from '../../models/notification.model';

// Now import the mocked functions and the controller
import { getUserByUsername, toggleFollowUser } from '../../services/user.service';
import userController from '../../controllers/user.controller';

const app = express();
app.use(express.json());

// Fake socket to satisfy userController signature
const fakeSocket = {
  emit: jest.fn(),
} as any;

app.use('/api/user', userController(fakeSocket));

describe('POST /api/user/toggleFollow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a follow notification on new follow', async () => {
    const currentId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();

    const currentBefore = {
      _id: currentId,
      username: 'alice',
      followers: [],
      following: [], // not following yet
    };

    const targetUser = {
      _id: targetId,
      username: 'bob',
      followers: [],
      following: [],
    };

    // getUserByUsername is called twice: [currentBefore, targetUser]
    (getUserByUsername as jest.Mock)
      .mockResolvedValueOnce(currentBefore)
      .mockResolvedValueOnce(targetUser);

    // toggleFollowUser returns updated current user with following list including target
    (toggleFollowUser as jest.Mock).mockResolvedValueOnce({
      ...currentBefore,
      following: [targetId],
    });

    const createSpy = jest.spyOn(NotificationModel, 'create').mockResolvedValueOnce({} as any);
    const emitSpy = emitNotification as jest.Mock;

    const res = await request(app)
      .post('/api/user/toggleFollow')
      .send({ currentUsername: 'alice', targetUsername: 'bob' });

    expect(res.status).toBe(200);
    expect(toggleFollowUser).toHaveBeenCalledWith('alice', 'bob');

    // Because wasFollowing was false, this is a FOLLOW → notification created + ping emitted
    expect(createSpy).toHaveBeenCalledTimes(1);

    const doc = createSpy.mock.calls[0][0] as {
      user: string;
      actor: string;
      targetType: string;
      category: string;
      location: string;
      link: string;
    };

    expect(doc.user).toBe('bob'); // recipient
    expect(doc.actor).toBe('alice'); // follower
    expect(doc.targetType).toBe('User');
    expect(doc.category).toBe('follow');
    expect(doc.location).toBe('following');
    expect(doc.link).toBe('/user/alice');

    expect(emitSpy).toHaveBeenCalledWith('bob');

    // Socket userUpdate event still fired
    expect(fakeSocket.emit).toHaveBeenCalledWith('userUpdate', {
      user: expect.any(Object),
      type: 'updated',
    });
  });

  it('does not create a notification on unfollow', async () => {
    const currentId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();

    const currentBefore = {
      _id: currentId,
      username: 'alice',
      followers: [],
      // Already following target
      following: [targetId],
    };

    const targetUser = {
      _id: targetId,
      username: 'bob',
      followers: [],
      following: [],
    };

    (getUserByUsername as jest.Mock)
      .mockResolvedValueOnce(currentBefore)
      .mockResolvedValueOnce(targetUser);

    // toggleFollowUser returns updated user with empty following (unfollow)
    (toggleFollowUser as jest.Mock).mockResolvedValueOnce({
      ...currentBefore,
      following: [],
    });

    const createSpy = jest.spyOn(NotificationModel, 'create').mockResolvedValueOnce({} as any);
    const emitSpy = emitNotification as jest.Mock;

    const res = await request(app)
      .post('/api/user/toggleFollow')
      .send({ currentUsername: 'alice', targetUsername: 'bob' });

    expect(res.status).toBe(200);
    expect(toggleFollowUser).toHaveBeenCalledWith('alice', 'bob');

    // Because wasFollowing was true, this is an UNFOLLOW → no notification
    expect(createSpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();

    // Still emits userUpdate via socket
    expect(fakeSocket.emit).toHaveBeenCalledWith('userUpdate', {
      user: expect.any(Object),
      type: 'updated',
    });
  });

  it('returns 400 when body is missing usernames', async () => {
    const res = await request(app).post('/api/user/toggleFollow').send({});

    expect(res.status).toBe(400);
    expect(res.text).toBe('Both currentUsername and targetUsername are required');
  });
});
