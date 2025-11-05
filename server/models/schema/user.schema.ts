import { Schema } from 'mongoose';

/**
 * Mongoose schema for the User collection.
 *
 * This schema defines the structure for storing users in the database.
 * Each User includes the following fields:
 * - `username`: The username of the user.
 * - `password`: The encrypted password securing the user's account.
 * - `dateJoined`: The date the user joined the platform.
 *  - `biography`: A brief biography of the user.
 *  - `followers`: An array of users representing users who follow this user.
 *  - `following`: An array of users representing users this user follows.
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
  },
  { collection: 'User' },
);

export default userSchema;
