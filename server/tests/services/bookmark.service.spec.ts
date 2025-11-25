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

  // Plain JS object that matches DatabaseBookmark
  const mockBookmarkPlain = {
    _id: new mongoose.Types.ObjectId('65e9b58910afe6e94fc6e6bb'),
    username,
    targetId: mockTargetId,
    targetType: 'Community' as const,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  // Mongoose-like document with .toObject()
  const mockBookmarkDoc = {
    ...mockBookmarkPlain,
    toObject: jest.fn().mockReturnValue(mockBookmarkPlain),
  };

  // ─────────────────────────────────────────────
  // toggleBookmark
  // ─────────────────────────────────────────────
  describe('toggleBookmark', () => {
    test('should remove an existing bookmark', async () => {
      // Service calls: BookmarkModel.findOne(...).exec()
      (BookmarkModel.findOne as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockBookmarkDoc),
      });
      (BookmarkModel.deleteOne as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce({ deletedCount: 1 }),
      });

      const result = await toggleBookmark(username, mockTargetId.toString(), 'Community');

      expect(result).toEqual({ removed: true });
      expect(BookmarkModel.findOne).toHaveBeenCalledWith({
        username,
        // service uses new ObjectId(targetId), so we just assert it's an ObjectId
        targetId: expect.any(mongoose.Types.ObjectId),
        targetType: 'Community',
      });
      expect(BookmarkModel.deleteOne).toHaveBeenCalledWith({ _id: mockBookmarkDoc._id });
    });

    test('should create a new bookmark when none exists', async () => {
      // No existing bookmark
      (BookmarkModel.findOne as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(null),
      });
      // Successfully created bookmark doc
      (BookmarkModel.create as jest.Mock).mockResolvedValueOnce(mockBookmarkDoc);

      const result = await toggleBookmark(username, mockTargetId.toString(), 'Community');

      // Service returns the plain object from toObject()
      expect(result).toEqual(mockBookmarkPlain);

      expect(BookmarkModel.findOne).toHaveBeenCalledWith({
        username,
        targetId: expect.any(mongoose.Types.ObjectId),
        targetType: 'Community',
      });
      expect(BookmarkModel.create).toHaveBeenCalledWith({
        username,
        targetId: expect.any(mongoose.Types.ObjectId),
        targetType: 'Community',
      });
    });

    test('should return error if database throws when searching for bookmark', async () => {
      // Now we mock .exec() throwing, since service calls findOne().exec()
      (BookmarkModel.findOne as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockRejectedValueOnce(new Error('DB Error')),
      });

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
        ...mockBookmarkDoc,
        targetId: new mongoose.Types.ObjectId(),
        toObject: jest.fn().mockReturnValue(mockBookmarkDoc),
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

    test('should drop Collection bookmarks when populateDocument returns error', async () => {
      // bookmarks list as usual
      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(bookmarks),
      });

      // Simulate populateDocument returning an error object
      (populateDocument as jest.Mock).mockResolvedValueOnce({ error: 'Not found' });

      const result = await getBookmarksByUsername(username, 'Collection');

      // Service should filter out entries with populatedTarget = null
      if ('error' in result) {
        throw new Error('Expected array, got error result');
      }

      const castResult = result as any[];
      expect(castResult).toEqual([]); // everything filtered out
      expect(populateDocument).toHaveBeenCalledWith(expect.any(String), 'collection');
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
