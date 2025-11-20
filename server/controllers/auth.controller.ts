// auth.controller.ts
import express, { Request, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { getUserByUsername, saveUser } from '../services/user.service';
import { SafeDatabaseUser, User } from '../types/types';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CLIENT_URL } = process.env;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email returned from Google'));

          let user = await getUserByUsername(email);

          if ('error' in user) {
            // Google users need a random hashed password
            const randomPassword = crypto.randomBytes(20).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const newUser: User = {
              username: email,
              email,
              password: hashedPassword,
              dateJoined: new Date(),
              biography: '',
              followers: [],
              following: [],
            };

            const saved = await saveUser(newUser, 'google-oauth', 'google-oauth');

            if ('error' in saved) return done(saved.error);
            user = saved;
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

// Serialize full user object
passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

// Deserialize user based on username/id
passport.deserializeUser(async (user: SafeDatabaseUser, done) => {
  try {
    const found = await getUserByUsername(user.username);
    done(null, found);
  } catch (err) {
    done(err as Error);
  }
});

/**
 * Generates a signed JWT for a given user.
 * @param user - The user object containing at least a `username` property.
 * @returns A signed JWT string.
 */
const generateJwt = (user: SafeDatabaseUser) => {
  return jwt.sign(
    {
      _id: user._id,
      username: user.username,
      email: user.email,
      dateJoined: user.dateJoined,
      followers: user.followers,
      following: user.following,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
};

const authController = () => {
  const router: Router = express.Router();

  const googleAuth = (req: Request, res: Response) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res);
  };

  const googleCallback = (req: Request, res: Response) => {
    passport.authenticate(
      'google',
      { failureRedirect: '/login?error=google' },
      (err: Error | null, user: SafeDatabaseUser | false, info: object | undefined) => {
        if (err) {
          return res.redirect(`/login?error=${err.message}`);
        }
        if (!user) {
          return res.redirect('/login?error=bad_user');
        }

        // Generate JWT for frontend
        const token = generateJwt(user);
        res.redirect(`${CLIENT_URL}/oauth-success?token=${token}`);
        // res.redirect(`http://localhost:4530/oauth-success?token=${token}`);
      },
    )(req, res);
  };

  const logout = (req: Request, res: Response) => {
    req.logout(() => {
      res.status(200).json({ message: 'Logged out successfully' });
    });
  };

  router.get('/google', googleAuth);
  router.get('/google/callback', googleCallback);
  router.post('/logout', logout);

  return router;
};

export default authController;
