// tests/services/bookmark.service.spec.ts
import mongoose from 'mongoose';
import BookmarkModel from '../../models/bookmark.model';
import UserModel from '../../models/users.model';
import CommunityModel from '../../models/community.model';
import { populateDocument } from '../../utils/database.util';
import { toggleBookmark, getBookmarksByUsername } from '../../services/bookmark.service';

jest.mock('../../models/bookmark.model');
jest.mock('../../models/users.model');
jest.mock('../../models/community.model');
jest.mock('../../utils/database.util');

describe('Bookmark Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const username = 'test_user';
  const mockTargetId = new mongoose.Types.ObjectId('65e9b58910afe6e94fc6e6aa');

  const mockBookmark = {
    _id: new mongoose.Types.ObjectId(),
    username,
    targetId: mockTargetId.toString(),
    targetType: 'Community',
    createdAt: new Date(),
    toObject: jest.fn().mockReturnValue({
      _id: new mongoose.Types.ObjectId(),
      username,
      targetId: mockTargetId.toString(),
      targetType: 'Community',
      createdAt: new Date(),
    }),
  };

  // ─────────────────────────────────────────────
  // toggleBookmark
  // ─────────────────────────────────────────────
  describe('toggleBookmark', () => {
    test('should remove an existing bookmark', async () => {
      (BookmarkModel.findOne as jest.Mock).mockResolvedValueOnce(mockBookmark);
      (BookmarkModel.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });

      const result = await toggleBookmark(username, mockTargetId.toString(), 'Community');

      expect(result).toEqual({ removed: true });
      expect(BookmarkModel.findOne).toHaveBeenCalledWith({
        username,
        targetId: mockTargetId.toString(),
        targetType: 'Community',
      });
      expect(BookmarkModel.deleteOne).toHaveBeenCalled();
    });

    test('should create a new bookmark when none exists', async () => {
      // No existing bookmark
      (BookmarkModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      // Successfully created bookmark
      (BookmarkModel.create as jest.Mock).mockResolvedValueOnce(mockBookmark);

      const result = await toggleBookmark(username, mockTargetId.toString(), 'Community');

      // Implementation returns the created bookmark document
      expect(result).toEqual(mockBookmark);
      expect(BookmarkModel.findOne).toHaveBeenCalledWith({
        username,
        targetId: mockTargetId.toString(),
        targetType: 'Community',
      });
      expect(BookmarkModel.create).toHaveBeenCalled();
    });

    test('should return error if database throws when searching for bookmark', async () => {
      (BookmarkModel.findOne as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await toggleBookmark(username, mockTargetId.toString(), 'Collection');

      expect(result).toEqual({ error: 'DB Error' });
    });
  });

  // ─────────────────────────────────────────────
  // getBookmarksByUsername
  // ─────────────────────────────────────────────
  describe('getBookmarksByUsername', () => {
    const bookmarks = [
      {
        ...mockBookmark,
        targetId: new mongoose.Types.ObjectId(),
        toObject: jest.fn().mockReturnValue(mockBookmark),
      },
    ];

    test('should populate User bookmarks', async () => {
      const user = { username: 'john', followers: [], following: [] };

      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(bookmarks),
      });
      (UserModel.findById as jest.Mock).mockResolvedValueOnce(user);

      const result = await getBookmarksByUsername(username, 'User');

      if (!('error' in result)) {
        const castResult = result as any[];
        expect(castResult[0].populatedTarget).toEqual(user);
      }
      expect(UserModel.findById).toHaveBeenCalled();
    });

    test('should populate Community bookmarks', async () => {
      const community = { name: 'Test Community', participants: [] };

      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(bookmarks),
      });
      (CommunityModel.findById as jest.Mock).mockResolvedValueOnce(community);

      const result = await getBookmarksByUsername(username, 'Community');

      if (!('error' in result)) {
        const castResult = result as any[];
        expect(castResult[0].populatedTarget).toEqual(community);
      }
      expect(CommunityModel.findById).toHaveBeenCalled();
    });

    test('should populate Collection bookmarks using populateDocument', async () => {
      const collection = { name: 'Test Collection' };

      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(bookmarks),
      });
      (populateDocument as jest.Mock).mockResolvedValueOnce(collection);

      const result = await getBookmarksByUsername(username, 'Collection');

      if (!('error' in result)) {
        const castResult = result as any[];
        expect(castResult[0].populatedTarget).toEqual(collection);
      }
      expect(populateDocument).toHaveBeenCalled();
    });

    test('should return raw bookmarks if no targetType specified', async () => {
      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(bookmarks),
      });

      const result = await getBookmarksByUsername(username);

      if (!('error' in result)) {
        const castResult = result as any[];
        expect(castResult).toEqual(bookmarks);
      }
    });

    test('returns null if bookmarks list is null', async () => {
      // For current implementation: if .sort() resolves to null, the service
      // simply returns null instead of wrapping in { error: ... }.
      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await getBookmarksByUsername(username);

      expect(result).toBeNull();
    });

    test('should return error if database throws', async () => {
      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockRejectedValueOnce(new Error('DB Error')),
      });

      const result = await getBookmarksByUsername(username);
      expect(result).toEqual({ error: 'DB Error' });
    });
  });
});
