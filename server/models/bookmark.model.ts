import mongoose, { Model } from 'mongoose';
import bookmarkSchema from './schema/bookmark.schema';
import { DatabaseBookmark } from '@fake-stack-overflow/shared';

/**
 * Mongoose model for the Bookmark collection.
 * Each document represents a bookmark created by a user
 * for a target entity (Collection, Community, or User).
 * The schema enforces uniqueness on the combination of
 * username, targetId, and targetType to prevent duplicate bookmarks.
 * This model is used throughout the application to
 * create, retrieve, and delete bookmarks.
 */
const BookmarkModel: Model<DatabaseBookmark> = mongoose.model<DatabaseBookmark>(
  'Bookmark',
  bookmarkSchema,
);

export default BookmarkModel;
