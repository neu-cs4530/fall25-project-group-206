import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { saveUser, getUserByUsername } from '../services/user.service';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../types/types';

const { REACT_APP_GOOGLE_CLIENT_ID, REACT_APP_GOOGLE_CLIENT_SECRET } = process.env;

// Only register Google strategy if creds exist and not running tests
if (
  REACT_APP_GOOGLE_CLIENT_ID &&
  REACT_APP_GOOGLE_CLIENT_SECRET &&
  process.env.NODE_ENV !== 'test'
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
        clientSecret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET!,
        callbackURL: '/api/user/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email found'));

          let user = await getUserByUsername(email);

          if ('error' in user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
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

            const result = await saveUser(newUser, 'unknown', 'google-oauth');
            if ('error' in result) return done(result.error);

            user = result;
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

// Serialize/Deserialize user for session (optional if using sessions)
passport.serializeUser((user: Express.User, done) => done(null, user));
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await getUserByUsername(id);
    done(null, user);
  } catch (err) {
    done(err as Error);
  }
});
