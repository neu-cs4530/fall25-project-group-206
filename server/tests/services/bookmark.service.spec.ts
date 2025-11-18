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

// Test suite for bookmark service
describe('Bookmark Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const username = 'test_user';
  const mockTargetId = new mongoose.Types.ObjectId('65e9b58910afe6e94fc6e6aa');
  const mockBookmark = {
    _id: new mongoose.Types.ObjectId(),
    username,
    targetId: mockTargetId,
    targetType: 'Community',
    createdAt: new Date(),
  };

  // Tests for toggleBookmark
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

    // Tests for error handling
    test('should return error if database throws', async () => {
      (BookmarkModel.findOne as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await toggleBookmark(username, mockTargetId.toString(), 'Collection');
      expect(result).toEqual({ error: 'DB Error' });
    });
  });

  // Tests for getBookmarksByUsername
  describe('getBookmarksByUsername', () => {
    const bookmarks = [
      {
        ...mockBookmark,
        targetId: new mongoose.Types.ObjectId(),
        toObject: jest.fn().mockReturnValue(mockBookmark),
      },
    ];

    // Tests for populating User bookmarks
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

    // Tests for populating Community bookmarks
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

    // Tests for populating Collection bookmarks
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

    // Test for no targetType specified
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

    // Tests for error handling
    test('should return error if database throws', async () => {
      (BookmarkModel.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockRejectedValueOnce(new Error('DB Error')),
      });

      const result = await getBookmarksByUsername(username);
      expect(result).toEqual({ error: 'DB Error' });
    });
  });
});
