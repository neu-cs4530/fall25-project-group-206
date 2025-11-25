import BookmarkModel from '../models/bookmark.model';
import { populateDocument } from '../utils/database.util';
import { ObjectId } from 'mongodb';
import { DatabaseBookmark } from '@fake-stack-overflow/shared';
import CommunityModel from '../models/community.model';
import UserModel from '../models/users.model';

/**
 * Toggles a bookmark (add/remove) for a specific user and target.
 * @param username - The username of the user
 * @param targetId - The ID of the target (Collection, Community, or User)
 * @param targetType - The type of the target
 * @returns The updated bookmark or an error message
 */
export const toggleBookmark = async (
  username: string,
  targetId: string,
  targetType: 'Collection' | 'Community' | 'User',
): Promise<DatabaseBookmark | { removed: boolean } | { error: string }> => {
  try {
    const targetObjectId = new ObjectId(targetId);

    const existing = await BookmarkModel.findOne({
      username,
      targetId: targetObjectId,
      targetType,
    }).exec();

    if (existing) {
      await BookmarkModel.deleteOne({ _id: existing._id }).exec();
      return { removed: true };
    }

    const newBookmarkDoc = await BookmarkModel.create({
      username,
      targetId: targetObjectId,
      targetType,
    });

    // toObject is typed if the model is typed as DatabaseBookmark in the model file
    const newBookmark = newBookmarkDoc.toObject() as DatabaseBookmark;

    return newBookmark;
  } catch (error) {
    return { error: (error as Error).message };
  }
};

/**
 * Retrieves bookmarks for a specific user, optionally filtered by target type.
 * Populates related entities depending on type.
 * @param username - The username of the user
 * @param targetType - The type of the target (optional)
 * @returns An array of bookmarks or an error message
 */
export const getBookmarksByUsername = async (
  username: string,
  targetType?: 'Collection' | 'Community' | 'User',
): Promise<DatabaseBookmark[] | { error: string }> => {
  try {
    const filter = targetType ? { username, targetType } : { username };
    const bookmarks = await BookmarkModel.find(filter).sort({ createdAt: -1 });

    // CASE 1: Bookmarked Users → populate bookmarked user profiles
    if (targetType === 'User') {
      const populatedUsers = await Promise.all(
        bookmarks.map(async b => {
          const user = await UserModel.findById(b.targetId).select(
            'username biography dateJoined followers following',
          );
          return {
            ...b.toObject(),
            populatedTarget: user || null,
          };
        }),
      );
      return populatedUsers.filter(b => b.populatedTarget);
    }

    // CASE 2: Bookmarked Communities → populate manually with CommunityModel
    if (targetType === 'Community') {
      const populatedCommunities = await Promise.all(
        bookmarks.map(async b => {
          const community = await CommunityModel.findById(b.targetId);
          return {
            ...b.toObject(),
            populatedTarget: community || null,
          };
        }),
      );
      return populatedCommunities.filter(b => b.populatedTarget);
    }

    // CASE 3: Bookmarked Collections → use populateDocument for consistency
    if (targetType === 'Collection') {
      const populatedCollections = await Promise.all(
        bookmarks.map(async b => {
          const collection = await populateDocument(b.targetId.toString(), 'collection');

          return {
            ...b.toObject(),
            populatedTarget: 'error' in collection ? null : collection,
          };
        }),
      );
      return populatedCollections.filter(b => b.populatedTarget);
    }

    // Default (no targetType): return everything mixed
    return bookmarks;
  } catch (error) {
    return { error: (error as Error).message };
  }
};
