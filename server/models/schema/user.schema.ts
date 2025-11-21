import { Schema } from 'mongoose';

/**
 * Mongoose schema for the User collection.
 *
 * This schema defines the structure for storing users in the database.
 * Each User includes the following fields:
 * - `username`: The username of the user.
 * - `password`: The encrypted password securing the user's account.
 * - `email`: The email tied to the user's account.
 * - `dateJoined`: The date the user joined the platform.
 * - `biography`: A brief biography of the user.
 * - `followers`: An array of users representing users who follow this user.
 * - `following`: An array of users representing users this user follows.
 * - `allowOpenMessaging`: Boolean indicating if the user allows messaging from non-followers (default: false).
 * - `twoFactorEnabled`: Boolean indicating if two-factor authentication (2FA) is enabled for the user (default: false).
 * - `twoFactorSecret`: The secret key used for 2FA, or null if 2FA is not enabled.
 * - `knownDevices`: An array of strings representing devices this user has logged in on.
 * - `isGoogleSSO`: Boolean indicating if user allows for Google SSO.
 */
const userSchema: Schema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      immutable: true,
    },
    password: {
      type: String,
    },
    email: {
      type: String,
      unique: false,
    },
    dateJoined: {
      type: Date,
    },
    biography: {
      type: String,
      default: '',
    },
    followers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
    },
    following: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
    },
    allowOpenMessaging: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      default: null,
    },
    knownDevices: {
      type: [String],
      default: [],
    },
    isGoogleSSO: {
      type: Boolean,
      default: true,
    },
  },
  { collection: 'User' },
);

export default userSchema;
