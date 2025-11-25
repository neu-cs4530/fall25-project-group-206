import {
  saveUser,
  getUserByUsername,
  getUserByEmail,
  getUsersList,
  loginUser,
  deleteUserByUsername,
  updateUser,
  toggleFollowUser,
  getFollowers,
  getFollowing,
  updateMessagingSetting,
  enable2FA,
  disable2FA,
  verify2FAToken,
  generate2FASecret,
  sendNewDeviceEmail,
  getDeviceId,
} from '../../services/user.service';

import UserModel from '../../models/users.model';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { User } from '@fake-stack-overflow/shared';
import fetchMock from 'jest-fetch-mock';

jest.mock('../../models/users.model');
jest.mock('bcrypt');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('nodemailer');

const mockUser: User = {
  username: 'testuser',
  password: 'hashedpass',
  email: 'email@test.com',
  dateJoined: new Date(),
  followers: [],
  following: [],
  knownDevices: [],
  isGoogleSSO: true,
};

fetchMock.enableMocks();

describe('user.service tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // saveUser
  // ----------------------------
  it('saves a user successfully', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpw');
    (UserModel.create as jest.Mock).mockResolvedValue(mockUser);

    const res = await saveUser(mockUser);
    expect(res).toHaveProperty('username', 'testuser');
    expect((bcrypt.hash as jest.Mock).mock.calls.length).toBe(1);
  });

  it('returns error if create fails', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpw');
    (UserModel.create as jest.Mock).mockRejectedValue(new Error('fail'));

    const res = await saveUser(mockUser);
    expect(res).toHaveProperty('error');
  });

  it('creates deviceId when ip & userAgent are provided', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpw');

    (UserModel.create as jest.Mock).mockImplementation(async (user: any) => {
      return { ...user };
    });

    const res = await saveUser(mockUser, '1.1.1.1', 'browser');

    if (res && 'knownDevices' in res) {
      const devices = res.knownDevices || [];
      expect(devices.length).toEqual(1);
    } else {
      fail(`Expected user, got error: ${(res as any)?.error}`);
    }
  });

  it('sets knownDevices to empty array when no ip/userAgent', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpw');
    (UserModel.create as jest.Mock).mockResolvedValue({ ...mockUser, knownDevices: [] });

    const res = await saveUser(mockUser);

    // Narrow the type
    if ('knownDevices' in res) {
      expect(res.knownDevices).toEqual([]);
    } else {
      fail(`Expected user, got error: ${(res as any).error}`);
    }
  });

  it('returns error when saveUser fails to create user', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpw');
    (UserModel.create as jest.Mock).mockResolvedValue(null);

    const res = await saveUser(mockUser);
    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toContain('Failed to create user');
  });

  // ----------------------------
  // getUserByUsername
  // ----------------------------
  it('gets user by username', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: '123', username: 'bob' }),
    });

    const res = await getUserByUsername('bob');
    expect(res).toHaveProperty('username', 'bob');
  });

  it('returns error if user not found (by username)', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await getUserByUsername('missing');
    expect(res).toHaveProperty('error');
  });

  it('throws error when getUserByUsername cannot find user', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await getUserByUsername('missing');

    if ('error' in res) {
      expect(res.error).toContain('User not found');
    } else {
      fail('Expected an error, got a user object');
    }
  });

  // ----------------------------
  // getUserByEmail
  // ----------------------------
  it('gets user by email', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: '123', email: 'x@y.com' }),
    });

    const res = await getUserByEmail('x@y.com');
    expect(res).toHaveProperty('email', 'x@y.com');
  });

  it('returns error if getUserByEmail fails', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('fail')),
    });

    const res = await getUserByEmail('x@y.com');
    expect(res).toHaveProperty('error');
  });

  it('throws error when getUserByEmail cannot find user', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res = await getUserByEmail('missing@test.com');
    expect(res).toHaveProperty('error');
    if ('error' in res) {
      expect(res.error).toContain('User not found');
    } else {
      fail('Expected an error, got a user object');
    }
  });

  // ----------------------------
  // getUsersList
  // ----------------------------
  it('gets users list', async () => {
    (UserModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue([{ username: 'a' }, { username: 'b' }]),
    });

    const res = await getUsersList();
    expect(Array.isArray(res)).toBe(true);
  });

  it('returns error if getUsersList fails', async () => {
    (UserModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('fail')),
    });

    const res = await getUsersList();
    expect(res).toHaveProperty('error');
  });

  it('getUsersList returns error when UserModel.find().select resolves to null', async () => {
    (UserModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const { getUsersList } = await import('../../services/user.service');
    const res = await getUsersList();

    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toContain('Users could not be retrieved');
  });

  // ----------------------------
  // loginUser
  // ----------------------------
  it('logs in user successfully', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValue({
      _id: '123',
      username: 'alice',
      password: 'hashedpw',
      email: 'a@b.com',
      knownDevices: [],
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const transport = { sendMail: jest.fn() };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(transport);

    const res = await loginUser({ username: 'alice', password: 'pw' }, '1.1.1.1', 'browser');

    expect(res).toHaveProperty('username', 'alice');
  });

  it('returns error if loginUser fails', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValue(null);

    const res = await loginUser({ username: 'missing', password: 'pw' });
    expect(res).toHaveProperty('error');
  });

  it('returns error when password is incorrect', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValue({
      _id: '123',
      username: 'alice',
      password: 'hashedpw',
      email: 'a@b.com',
      knownDevices: [],
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const res = await loginUser({ username: 'alice', password: 'wrong' });
    expect(res).toHaveProperty('error');
  });

  it('adds deviceId and calls sendNewDeviceEmail if device is new', async () => {
    const userWithNoDevices = { ...mockUser, _id: '123', knownDevices: [] };
    (UserModel.findOne as jest.Mock).mockResolvedValue(userWithNoDevices);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    fetchMock.mockResponseOnce(JSON.stringify({ status: 'ok' }), { status: 200 });

    const res = await loginUser(
      { username: 'testuser', password: 'hashedpass' },
      '1.1.1.1',
      'browser',
    );
    expect(res).toHaveProperty('username', 'testuser');
    expect(fetchMock).toHaveBeenCalledTimes(1); // email sent
  });

  // ----------------------------
  // deleteUserByUsername
  // ----------------------------
  it('deletes user successfully', async () => {
    (UserModel.findOneAndDelete as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ username: 'bob' }),
    });

    const res = await deleteUserByUsername('bob');
    expect(res).toHaveProperty('username', 'bob');
  });

  it('returns error when delete fails', async () => {
    (UserModel.findOneAndDelete as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await deleteUserByUsername('x');
    expect(res).toHaveProperty('error');
  });

  it('throws error if deleteUserByUsername cannot find user', async () => {
    (UserModel.findOneAndDelete as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const res = await deleteUserByUsername('missing');
    expect(res).toHaveProperty('error');
  });

  // ----------------------------
  // updateUser
  // ----------------------------
  it('updates user successfully', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ username: 'updated' }),
    });

    const res = await updateUser('joe', { biography: 'hi' });
    expect(res).toHaveProperty('username', 'updated');
  });

  it('returns error when update fails', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await updateUser('missing', { biography: 'hi' });
    expect(res).toHaveProperty('error');
  });

  it('throws error if updateUser cannot find user', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const res = await updateUser('missing', { biography: 'test' });
    expect(res).toHaveProperty('error');
  });

  // ----------------------------
  // toggleFollowUser
  // ----------------------------
  it('toggles follow successfully', async () => {
    (UserModel.findOne as jest.Mock)
      .mockResolvedValueOnce({
        _id: '1',
        username: 'a',
        followers: [],
        following: [],
      })
      .mockResolvedValueOnce({
        _id: '2',
        username: 'b',
        followers: [],
        following: [],
      });

    (UserModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: '1',
        username: 'a',
        followers: [],
        following: ['2'],
      }),
    });

    const res = await toggleFollowUser('a', 'b');
    expect(res).toHaveProperty('username');
  });

  it('returns error if user attempts to follow themselves', async () => {
    const res = await toggleFollowUser('bob', 'bob');
    expect(res).toHaveProperty('error');
  });

  it('returns error if database throws while toggling follow', async () => {
    (UserModel.findOne as jest.Mock).mockRejectedValue(new Error('fail'));

    const res = await toggleFollowUser('a', 'b');
    expect(res).toHaveProperty('error');
  });

  it('returns error if toggleFollowUser fails', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValue(null);

    const res = await toggleFollowUser('a', 'b');
    expect(res).toHaveProperty('error');
  });

  it('toggles follow/unfollow correctly', async () => {
    const userA = { _id: '1', username: 'a', followers: [], following: [] };
    const userB = { _id: '2', username: 'b', followers: [], following: [] };

    (UserModel.findOne as jest.Mock).mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);

    (UserModel.findByIdAndUpdate as jest.Mock).mockImplementation(() => {
      return {
        select: jest.fn().mockResolvedValue({ ...userA, following: ['2'], username: 'a' }),
      };
    });

    const res = await toggleFollowUser('a', 'b');

    if ('username' in res) {
      expect(res.username).toBe('a');
      expect(res.following).toContain('2');
    } else {
      throw new Error(`Expected user, got error: ${res.error}`);
    }
  });

  it('toggleFollowUser unfollows when currentUser.following contains target._id', async () => {
    const targetId = '2';
    const currentUser = {
      _id: '1',
      username: 'a',
      followers: [],
      following: [{ toString: () => targetId }],
    };
    const targetUser = {
      _id: targetId,
      username: 'b',
      followers: [{ toString: () => '1' }],
      following: [],
    };

    (UserModel.findOne as jest.Mock)
      .mockResolvedValueOnce(currentUser)
      .mockResolvedValueOnce(targetUser);

    const savedCurrent = {
      _id: '1',
      username: 'a',
      followers: [],
      following: [],
    };
    (UserModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(savedCurrent),
    });

    const { toggleFollowUser } = await import('../../services/user.service');
    const res = await toggleFollowUser('a', 'b');

    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      expect('username' in res).toBe(true);
      expect(Array.isArray(res.following)).toBe(true);
      expect(res.following.length).toBe(0);
    }
  });

  it('toggleFollowUser returns error when findByIdAndUpdate for current returns null', async () => {
    const targetId = '2';
    const currentUser = {
      _id: '1',
      username: 'a',
      followers: [],
      following: [],
    };
    const targetUser = {
      _id: targetId,
      username: 'b',
      followers: [],
      following: [],
    };

    (UserModel.findOne as jest.Mock)
      .mockResolvedValueOnce(currentUser)
      .mockResolvedValueOnce(targetUser);

    (UserModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const { toggleFollowUser } = await import('../../services/user.service');
    const res = await toggleFollowUser('a', 'b');

    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toContain('Error persisting follow changes');
  });

  // ----------------------------
  // getFollowers
  // ----------------------------
  it('gets followers', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        followers: [{ username: 'x' }],
      }),
    });

    const res = await getFollowers('bob');
    expect(Array.isArray(res)).toBe(true);
  });

  it('returns error if getFollowers fails', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('fail')),
    });

    const res = await getFollowers('bob');
    expect(res).toHaveProperty('error');
  });

  it('throws error if getFollowers cannot find user', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
    const res = await getFollowers('missing');
    expect(res).toHaveProperty('error');
  });

  // ----------------------------
  // getFollowing
  // ----------------------------
  it('gets following', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        following: [{ username: 'x' }],
      }),
    });

    const res = await getFollowing('bob');
    expect(Array.isArray(res)).toBe(true);
  });

  it('returns error if getFollowing fails', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('fail')),
    });

    const res = await getFollowing('bob');
    expect(res).toHaveProperty('error');
  });

  it('throws error if getFollowing cannot find user', async () => {
    (UserModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
    const res = await getFollowing('missing');
    expect(res).toHaveProperty('error');
  });

  // ----------------------------
  // updateMessagingSetting
  // ----------------------------
  it('updates messaging setting', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ allowOpenMessaging: true }),
    });

    const res = await updateMessagingSetting('bob', true);
    expect(res).toHaveProperty('allowOpenMessaging', true);
  });

  it('returns error if updateMessagingSetting fails', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await updateMessagingSetting('x', false);
    expect(res).toHaveProperty('error');
  });

  it('throws error if updateMessagingSetting cannot find user', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const res = await updateMessagingSetting('missing', true);
    expect(res).toHaveProperty('error');
  });

  it('updates messaging setting', async () => {
    const mockSelect = jest.fn().mockResolvedValue({
      ...mockUser,
      allowOpenMessaging: true,
    });

    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: mockSelect,
    });

    const res = await updateMessagingSetting('testuser', true);

    if ('allowOpenMessaging' in res) {
      expect(res.allowOpenMessaging).toBe(true);
    } else {
      const err = res as { error: string };
      throw new Error(`Expected updated user, got error: ${err.error}`);
    }
  });

  // ----------------------------
  // 2FA
  // ----------------------------
  it('generates 2FA secret', async () => {
    (speakeasy.generateSecret as jest.Mock).mockReturnValue({
      base32: 'SECRET',
      otpauth_url: 'otpauth://...',
    });

    (QRCode.toDataURL as jest.Mock).mockResolvedValue('qrcode-data');

    const res = await generate2FASecret('bob');
    expect(res.secret).toBe('SECRET');
  });

  it('enables 2FA', async () => {
    (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ username: 'bob', twoFactorEnabled: true }),
    });

    const res = await enable2FA('bob', 'SECRET', '123456');
    expect(res).toHaveProperty('twoFactorEnabled', true);
  });

  it('returns error when enable2FA receives invalid token', async () => {
    (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

    const res = await enable2FA('bob', 'SECRET', '123456');
    expect(res).toHaveProperty('error');
  });

  it('enable2FA returns error when findOneAndUpdate returns null', async () => {
    jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true);

    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const { enable2FA } = await import('../../services/user.service');

    const res = await enable2FA('someone', 'SECRET', '123456');

    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error).toContain('Error enabling 2FA');
    }
  });

  it('disables 2FA', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ username: 'bob', twoFactorEnabled: false }),
    });

    const res = await disable2FA('bob');
    expect(res).toHaveProperty('twoFactorEnabled', false);
  });

  it('returns error when disable2FA fails to find user', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await disable2FA('missing');
    expect(res).toHaveProperty('error');
  });

  it('verifies 2FA token', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValue({
      twoFactorSecret: 'SECRET',
    });

    (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

    const res = await verify2FAToken('bob', '123456');
    expect(res).toBe(true);
  });

  it('returns false when verify2FAToken fails', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValue(null);

    const res = await verify2FAToken('bob', '123456');
    expect(res).toBe(false);
  });

  it('verify2FAToken returns false when UserModel.findOne throws', async () => {
    (UserModel.findOne as jest.Mock).mockRejectedValue(new Error('DB down'));

    const { verify2FAToken } = await import('../../services/user.service');
    const res = await verify2FAToken('someone', '000000');

    expect(res).toBe(false);
  });

  it('returns error when disable2FA fails to find user', async () => {
    (UserModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await disable2FA('missing');
    expect(res).toHaveProperty('error');
  });

  it('returns error if QRCode generation fails', async () => {
    jest.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(undefined as never);

    await expect(generate2FASecret('123')).rejects.toThrow('Error generating 2FA secret');
  });

  // ------------
  // getDeviceId
  // ------------
  it('generates device id', () => {
    const spy = jest.spyOn(crypto, 'createHash');
    const hash = 'hashed-device';
    spy.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(hash),
    } as any);

    const deviceId = getDeviceId('1.1.1.1', 'UA');
    expect(deviceId).toBe(hash);
  });
});

describe('sendNewDeviceEmail', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    process.env.EMAILJS_SERVICEID = 'service_test';
    process.env.EMAILJS_TEMPLATEID = 'template_test';
    process.env.EMAILJS_PUBLIC_KEY = 'public_test';
  });

  it('sends email successfully', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ status: 'ok' }), { status: 200 });

    const result = await sendNewDeviceEmail('user@example.com', 'alice');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.emailjs.com/api/v1.0/email/send');

    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body).toMatchObject({
      service_id: 'service_test',
      template_id: 'template_test',
      user_id: 'public_test',
      template_params: {
        email: 'user@example.com',
        user: 'alice',
      },
    });

    expect(result).toEqual({ success: true });
  });

  it('returns error if fetch responds with non-ok status', async () => {
    fetchMock.mockResponseOnce('Bad Request', { status: 400 });

    const result = await sendNewDeviceEmail('user@example.com', 'alice');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Bad Request');
  });

  it('returns error if fetch throws', async () => {
    fetchMock.mockRejectOnce(new Error('Network failure'));

    const result = await sendNewDeviceEmail('user@example.com', 'alice');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Network failure');
  });

  it('sends correct template parameters', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ status: 'ok' }), { status: 200 });

    const email = 'abc@test.com';
    const username = 'bob';
    await sendNewDeviceEmail(email, username);

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.template_params.email).toBe(email);
    expect(body.template_params.user).toBe(username);
  });

  it('sendNewDeviceEmail returns error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network fail')) as any;
    const res = await sendNewDeviceEmail('a@b.com', 'testuser');

    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toContain('Network fail');
  });

  it('sendNewDeviceEmail returns Unknown error when fetch rejects with non-Error', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue('non-error-thing');

    const { sendNewDeviceEmail } = await import('../../services/user.service');
    const res = await sendNewDeviceEmail('x@y.com', 'someone');

    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toBe('Unknown error sending email');

    (global as any).fetch.mockReset();
    delete (global as any).fetch;
  });
});
