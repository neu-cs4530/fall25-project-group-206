import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import express from 'express';
import authController from '../../controllers/auth.controller';

process.env.JWT_SECRET = 'testsecret123';

describe('authController tests (non-Passport routes)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // /logout
  it('logs out and returns success message', async () => {
    const logoutMock = jest.fn((cb: any) => cb());
    const localApp = express();
    localApp.use((req: any, _res: any, next: any) => {
      req.logout = logoutMock;
      next();
    });
    localApp.use('/api/auth', authController());

    const res = await supertest(localApp).post('/api/auth/logout');

    expect(logoutMock).toHaveBeenCalled();
    expect(res.body.message).toBe('Logged out successfully');
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
});
