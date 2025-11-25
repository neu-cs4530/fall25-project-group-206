import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import authController from '../../controllers/auth.controller';

process.env.JWT_SECRET = 'testsecret123';

describe('authController tests (non-Passport routes)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // generateJwt pure test
  it('creates a valid JWT token', () => {
    const payload = {
      _id: new mongoose.Types.ObjectId(),
      username: 'abc',
      email: 'abc@gmail.com',
      dateJoined: new Date(),
      followers: [],
      following: [],
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    expect(decoded.username).toBe('abc');
    expect(decoded.email).toBe('abc@gmail.com');
  });

  // UTIL: create app with mocked passport
  const createApp = () => {
    const app = express();
    app.use('/api/auth', authController());
    return app;
  };

  it('redirects to Google OAuth login page', async () => {
    jest.spyOn(passport, 'authenticate').mockImplementation(() => {
      return (req: Request, res: Response) => res.redirect('https://google.com/oauth');
    });

    const app = createApp();
    const res = await supertest(app).get('/api/auth/google');

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('https://google.com/oauth');
  });

  it('redirects to frontend with error message when Google login fails', async () => {
    jest.spyOn(passport, 'authenticate').mockImplementation((strategy, options, callback) => {
      return () => callback!(new Error('Failed Google login'), false);
    });

    const app = createApp();
    const res = await supertest(app).get('/api/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('?error=Failed%20Google%20login');
  });

  it('redirects to frontend with error when user is invalid', async () => {
    jest.spyOn(passport, 'authenticate').mockImplementation((_strategy, _options, callback) => {
      return (_req: Request, _res: Response, _next: NextFunction) => callback!(null, false);
    });

    const app = createApp();
    const res = await supertest(app).get('/api/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('?error=Invalid%20user');
  });

  it('issues JWT and redirects to oauth-success on success', async () => {
    const fakeUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'abc',
      email: 'abc@gmail.com',
      dateJoined: new Date(),
      followers: [],
      following: [],
    };

    jest.spyOn(passport, 'authenticate').mockImplementation((_strategy, _options, callback) => {
      return (_req: Request, _res: Response, _next: NextFunction) => callback!(null, fakeUser);
    });

    const app = createApp();
    const res = await supertest(app).get('/api/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/oauth-success?token=');

    const token = res.header.location.split('token=')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as typeof fakeUser;
    expect(decoded.username).toBe(fakeUser.username);
  });
});

describe('passport serializer/deserializer tests', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.unmock('passport');
  });

  it('passport.serializeUser stores the full user object', async () => {
    const passportReal = await import('passport');
    await import('../../controllers/auth.controller');

    const internal = passportReal as {
      _serializers?: Array<(user: any, done: (err: Error | null, user?: any) => void) => void>;
      _deserializers?: Array<(obj: any, done: (err: Error | null, user?: any) => void) => void>;
    };

    const serializer = internal._serializers?.[0];
    if (!serializer) throw new Error('Serializer not registered');

    serializer({ username: 'testuser' }, (err: unknown, stored: unknown) => {
      expect(err).toBeNull();
      expect(stored).toEqual({ username: 'testuser' });
    });
  });

  describe('Google OAuth strategy verify callback', () => {
    const email = 'googleuser@example.com';
    const baseProfile = { emails: [{ value: email }] } as any;

    type ServiceMocks = {
      getUserByEmail: jest.Mock;
      getUserByUsername: jest.Mock;
      saveUser: jest.Mock;
    };

    const setupStrategy = async (
      overrides: Partial<ServiceMocks> = {},
    ): Promise<{ strategy: any } & ServiceMocks> => {
      // Base mocks: simulate no existing user so we hit the "create user" branch by default
      const getUserByEmail =
        overrides.getUserByEmail ?? jest.fn().mockResolvedValue({ error: 'not found' });
      const getUserByUsername =
        overrides.getUserByUsername ?? jest.fn().mockResolvedValue({ error: 'not found' });
      const saveUser =
        overrides.saveUser ??
        jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          username: email,
          email,
          dateJoined: new Date(),
          followers: [],
          following: [],
          isGoogleSSO: true,
        } as any);

      jest.doMock('../../services/user.service', () => ({
        getUserByEmail,
        getUserByUsername,
        saveUser,
      }));

      process.env.GOOGLE_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
      process.env.CLIENT_URL = 'http://client.test';

      const passportReal = await import('passport');
      await import('../../controllers/auth.controller');

      const internal = passportReal as unknown as {
        _strategies?: Record<string, any>;
      };

      const strategy = internal._strategies?.google;
      if (!strategy) {
        throw new Error('Google strategy not registered');
      }

      return { strategy, getUserByEmail, getUserByUsername, saveUser };
    };

    it('calls done with error when Google does not return an email', async () => {
      const { strategy } = await setupStrategy();

      await new Promise<void>(resolve => {
        strategy._verify(
          'access-token',
          'refresh-token',
          { emails: [] },
          (err: Error | null, user: unknown) => {
            expect(err).toBeInstanceOf(Error);
            expect(err?.message).toBe('No email returned from Google');
            expect(user).toBeUndefined();
            resolve();
          },
        );
      });
    });

    it('logs in an existing Google SSO user found by email', async () => {
      const existingUser = {
        _id: new mongoose.Types.ObjectId(),
        username: email,
        email,
        dateJoined: new Date(),
        followers: [],
        following: [],
        isGoogleSSO: true,
      };

      const { strategy, getUserByEmail, getUserByUsername, saveUser } = await setupStrategy({
        getUserByEmail: jest.fn().mockResolvedValue(existingUser),
      });

      await new Promise<void>(resolve => {
        strategy._verify(
          'access-token',
          'refresh-token',
          baseProfile,
          (err: Error | null, user: unknown) => {
            expect(err).toBeNull();
            expect(user).toEqual(existingUser);
            resolve();
          },
        );
      });

      expect(getUserByEmail).toHaveBeenCalledWith(email);
      expect(getUserByUsername).not.toHaveBeenCalled();
      expect(saveUser).not.toHaveBeenCalled();
    });

    it('rejects login when existing user has Google SSO disabled', async () => {
      const disabledUser = {
        _id: new mongoose.Types.ObjectId(),
        username: email,
        email,
        dateJoined: new Date(),
        followers: [],
        following: [],
        isGoogleSSO: false,
      };

      const { strategy } = await setupStrategy({
        getUserByEmail: jest.fn().mockResolvedValue(disabledUser),
      });

      await new Promise<void>(resolve => {
        strategy._verify(
          'access-token',
          'refresh-token',
          baseProfile,
          (err: Error | null, user: unknown) => {
            expect(err).toBeInstanceOf(Error);
            expect(err?.message).toBe('Google SSO has been disabled for this account');
            expect(user).toBeUndefined();
            resolve();
          },
        );
      });
    });

    it('creates a new Google SSO user when none exists', async () => {
      const { strategy, getUserByEmail, getUserByUsername, saveUser } = await setupStrategy();

      await new Promise<void>(resolve => {
        strategy._verify(
          'access-token',
          'refresh-token',
          baseProfile,
          (err: Error | null, user: any) => {
            expect(err).toBeNull();
            expect(user).toEqual(
              expect.objectContaining({
                username: email,
                email,
                isGoogleSSO: true,
              }),
            );
            resolve();
          },
        );
      });

      expect(getUserByEmail).toHaveBeenCalledWith(email);
      expect(getUserByUsername).toHaveBeenCalledWith(email);
      expect(saveUser).toHaveBeenCalled();
    });
  });

  it('passport.deserializeUser looks up user by username', async () => {
    jest.doMock('../../services/user.service', () => ({
      getUserByUsername: jest.fn().mockResolvedValue({ username: 'testuser' }),
    }));

    const passportReal = await import('passport');
    await import('../../controllers/auth.controller');

    const internal = passportReal as {
      _serializers?: Array<(user: any, done: (err: Error | null, user?: any) => void) => void>;
      _deserializers?: Array<(obj: any, done: (err: Error | null, user?: any) => void) => void>;
    };

    const deserializer = internal._deserializers?.[0];
    if (!deserializer) throw new Error('Deserializer not registered');

    deserializer({ username: 'testuser' }, (err: unknown, user: unknown) => {
      expect(err).toBeNull();
      expect(user).toEqual({ username: 'testuser' });
    });
  });

  it('passport.deserializeUser calls done with error on failure', async () => {
    const fakeError = new Error('DB failure');

    jest.mock('../../services/user.service', () => ({
      getUserByUsername: jest.fn().mockRejectedValue(fakeError),
    }));

    const passportReal = await import('passport');
    await import('../../controllers/auth.controller');

    const internal = passportReal as {
      _deserializers?: Array<(obj: any, done: (err: Error | null, user?: any) => void) => void>;
    };

    const deserializer = internal._deserializers?.[0];
    if (!deserializer) throw new Error('Deserializer not registered');

    await new Promise<void>(resolve => {
      deserializer({ username: 'testuser' }, (err, user) => {
        expect(err).toBeDefined();
        expect(err!.message).toBe('DB failure');
        expect(user).toBeUndefined();
        resolve();
      });
    });
  });
});
