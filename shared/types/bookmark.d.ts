import { Request } from 'express';
import { ObjectId } from 'mongodb';

/**
 * Represents a bookmark.
 * - `username`: The user who created the bookmark.
 * - `targetId`: The ID of the bookmarked entity (Collection, Community, or User).
 * - `targetType`: The type of the bookmarked entity.
 */
export interface Bookmark {
  username: string;
  targetId: ObjectId;
  targetType: 'Collection' | 'Community' | 'User';
}

/**
 * Represents a bookmark stored in the database.
 * - `_id`: The unique identifier of the bookmark document.
 * - `createdAt`: The timestamp when the bookmark was created.
 */
export interface DatabaseBookmark extends Bookmark {
  _id: ObjectId;
  createdAt: Date;
}

/**
 * Represents a bookmark with populated target entity data.
 * - `populatedTarget`: The populated data of the bookmarked entity.
 * Can be a Collection, Community, User, or null if not populated.
 */
export interface PopulatedDatabaseBookmark extends DatabaseBookmark {
  populatedTarget?: {
    _id?: string;
    name?: string;
    username?: string;
    participants?: unknown[];
    [key: string]: unknown;
  } | null;
}

/**
 * Represents a bookmark response type.
 * - Either a `DatabaseBookmark` object or an error message.
 */
export type BookmarkResponse = DatabaseBookmark | { error: string };

/**
 * Represents a request to toggle a bookmark (add or remove).
 * - `username`: The user performing the action.
 * - `targetId`: The ID of the target being bookmarked.
 * - `targetType`: The type of the target being bookmarked.
 */
export interface ToggleBookmarkRequest extends Request {
  body: {
    username: string;
    targetId: string;
    targetType: 'Collection' | 'Community' | 'User';
  };
}

/**
 * Represents a request to get bookmarks for a specific user.
 * - `username`: The user whose bookmarks are being retrieved.
 * - Optional `targetType`: Filter by entity type (Collection, Community, User).
 */
export interface GetBookmarksByUserRequest extends Request {
  params: {
    username: string;
  };
  query: {
    targetType?: 'Collection' | 'Community' | 'User';
  };
}
