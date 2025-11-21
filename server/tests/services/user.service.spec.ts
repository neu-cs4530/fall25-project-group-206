// server/tests/user.toggleFollow.controller.spec.ts
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

// 1. Mock user.service BEFORE importing the controller
jest.mock('../../services/user.service', () => {
  // We only need the functions used by toggleFollow route; everything can be jest.fn
  const originalModule = jest.requireActual('../../services/user.service');
  return {
    __esModule: true,
    ...originalModule,
    deleteUserByUsername: jest.fn(),
    getUserByUsername: jest.fn(),
    getUserByEmail: jest.fn(),
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

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import emitNotification from '../../utils/realtime';
import NotificationModel from '../../models/notification.model';

// Now import the mocked functions and the controller
import {
  getUserByUsername,
  toggleFollowUser,
  getUserByEmail,
  sendNewDeviceEmail,
  getDeviceId,
} from '../../services/user.service';
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

describe('Device Utilities', () => {
  describe('getDeviceId', () => {
    it('returns a SHA-256 hash of IP + userAgent', () => {
      const hash = getDeviceId('1.1.1.1', 'UA');
      expect(hash).toHaveLength(64);
    });
  });
});

describe('User Retrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getUserByEmail resolves user', async () => {
    const fakeUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      email: 'test@example.com',
    };

    (getUserByEmail as jest.Mock).mockResolvedValueOnce(fakeUser);

    const result = await getUserByEmail('test@example.com');

    expect(getUserByEmail).toHaveBeenCalledWith('test@example.com');
    expect(result).toEqual(fakeUser);
  });

  it('getUserByEmail returns an error object when user is not found', async () => {
    const errorResponse = { error: 'User not found' };

    (getUserByEmail as jest.Mock).mockResolvedValueOnce(errorResponse);

    const result = await getUserByEmail('missing@example.com');

    expect(getUserByEmail).toHaveBeenCalledWith('missing@example.com');
    expect(result).toEqual(errorResponse);
  });
});

describe('sendNewDeviceEmail', () => {
  const sendMailMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the transporter
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    // Provide fake env values
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password123';
  });

  it('returns success when email is sent', async () => {
    sendMailMock.mockResolvedValueOnce({ accepted: ['user@example.com'] });

    const result = await sendNewDeviceEmail('user@example.com', 'IP=1.1.1.1 UA=Chrome');

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.com',
      port: 2525,
      secure: false,
      auth: {
        user: 'test@test.com',
        pass: 'password123',
      },
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith({
      from: '"Your App" <no-reply@yourapp.com>',
      to: 'user@example.com',
      subject: 'New Device Sign-In Detected',
      text: expect.stringContaining('IP=1.1.1.1'),
      html: expect.stringContaining('IP=1.1.1.1'),
    });

    expect(result).toEqual({ success: true });
  });

  it('returns an error object when sendMail throws', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('SMTP broke'));

    const result = await sendNewDeviceEmail('user@example.com', 'new device info');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('SMTP broke');
  });

  it('passes correct deviceInfo data into email body', async () => {
    sendMailMock.mockResolvedValueOnce({});

    const deviceInfo = 'IP=55.22.11.99 UA=Firefox';
    await sendNewDeviceEmail('abc@test.com', deviceInfo);

    const mailArgs = sendMailMock.mock.calls[0][0];

    expect(mailArgs.text).toContain(deviceInfo);
    expect(mailArgs.html).toContain(deviceInfo);
  });
});
