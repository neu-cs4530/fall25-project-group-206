import { Schema, Types } from 'mongoose';

/**
 * Mongoose schema for the Bookmark collection.
 *
 * Each bookmark links a user (`username`) to a target entity:
 * - Collection
 * - Community
 * - User
 *
 * This allows a unified bookmark system while still supporting
 * per-type filtering on the frontend (e.g., separate tabs for each type).
 */
const bookmarkSchema = new Schema(
  {
    /**
     * The username of the user who created the bookmark.
     */
    username: {
      type: String,
      required: true,
      index: true, // improves query performance for user-specific lookups
    },

    /**
     * The ObjectId of the target entity (Collection, Community, or User).
     */
    targetId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },

    /**
     * The type of the bookmarked entity.
     * Helps frontend filtering and determines how to populate data.
     */
    targetType: {
      type: String,
      required: true,
      enum: ['Collection', 'Community', 'User'],
    },

    /**
     * Timestamp for when the bookmark was created.
     */
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // prevents accidental overwrites
    },
  },
  {
    collection: 'Bookmark',
    timestamps: false, // already have createdAt
  },
);

/**
 * Ensure that a user cannot bookmark the same entity twice.
 */
bookmarkSchema.index({ username: 1, targetId: 1, targetType: 1 }, { unique: true });

export default bookmarkSchema;
