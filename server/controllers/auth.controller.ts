import express, { Request, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { getUserByUsername, getUserByEmail, saveUser } from '../services/user.service';
import { SafeDatabaseUser, User } from '../types/types';

/**
 * Authentication Controller
 * -------------------------
 * Handles Google OAuth login, session management, and JWT issuance.
 *
 * Flow Summary:
 * 1. User clicks "Sign in with Google".
 * 2. Redirects to Google OAuth page -> `/api/auth/google`.
 * 3. Google redirects back -> `/api/auth/google/callback`.
 * 4. If Google user email matches an existing account → log in.
 * 5. If no user exists → create new user using email + random password.
 * 6. Issue JWT and redirect to CLIENT_URL with token.
 */

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CLIENT_URL } = process.env;
const FRONTEND_LOGIN_URL = CLIENT_URL;
// const FRONTEND_LOGIN_URL = 'http://localhost:4530';

/**
 * Configure Google OAuth strategy if credentials exist.
 *
 * Strategy Behavior:
 * - Extract user's Google email from OAuth profile.
 * - Check database for existing user by email.
 * - If not found, also check by username (email string).
 * - If no existing user → create a Google SSO user with random password.
 * - Return the user to Passport's `done()` callback.
 */
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

          // STEP 1: Attempt lookup by email
          let user = await getUserByEmail(email);

          if ('error' in user) {
            // STEP 2: Attempt lookup by username
            user = await getUserByUsername(email);
          }

          if (!('error' in user)) {
            // User exists, check if Google SSO is enabled
            if (!user.isGoogleSSO) {
              return done(new Error('Google SSO has been disabled for this account'));
            }
            return done(null, user); // User exists and Google SSO is enabled → login
          }

          // STEP 3: No user found → create new SSO user
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
            isGoogleSSO: true,
          };

          const saved = await saveUser(newUser, 'google-oauth', 'google-oauth');
          if ('error' in saved) return done(saved.error);

          return done(null, saved);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}

/**
 * Serialize user object into the session.
 *
 * Stores the full user object as the session payload.
 */
passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

/**
 * Deserialize user from session.
 *
 * Looks up the full user record using the username from the session.
 */
passport.deserializeUser(async (user: SafeDatabaseUser, done) => {
  try {
    const found = await getUserByUsername(user.username);
    done(null, found);
  } catch (err) {
    done(err as Error);
  }
});

/**
 * Generates a signed JWT for authenticated users.
 *
 * @param user - Database user object.
 * @returns A signed JWT valid for 1 hour.
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

/**
 * Main Auth Controller Factory
 * ----------------------------
 * Returns an Express Router containing authentication endpoints.
 */
const authController = () => {
  const router: Router = express.Router();

  // /**
  //  * GET /api/auth/google
  //  * --------------------
  //  * Redirects the user to Google's OAuth login page.
  //  *
  //  * Scope:
  //  * - `profile`: basic Google profile info
  //  * - `email`: user's Google email
  //  */
  const googleAuth = (req: Request, res: Response) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res);
  };

  /**
   * GET /api/auth/google/callback
   * -----------------------------
   * Handles Google's OAuth callback.
   *
   * Behavior:
   * - If login fails → redirect to `/login?error=<reason>`
   * - If successful → generate JWT and redirect to CLIENT_URL/oauth-success
   */
  const googleCallback = (req: Request, res: Response) => {
    passport.authenticate(
      'google',
      { failureRedirect: `${FRONTEND_LOGIN_URL}/login` }, // fallback if passport fails
      (err: Error | null, user: SafeDatabaseUser | false) => {
        if (err) {
          // Redirect to frontend login page and pass the error message
          return res.redirect(`${FRONTEND_LOGIN_URL}/?error=${encodeURIComponent(err.message)}`);
        }
        if (!user) {
          return res.redirect(`${FRONTEND_LOGIN_URL}/?error=${encodeURIComponent('Invalid user')}`);
        }

        const token = generateJwt(user);
        res.redirect(`${FRONTEND_LOGIN_URL}/oauth-success?token=${token}`);
      },
    )(req, res);
  };

  // Route Bindings
  router.get('/google', googleAuth);
  router.get('/google/callback', googleCallback);

  return router;
};

export default authController;
