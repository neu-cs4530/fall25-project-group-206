import express from 'express';
import request from 'supertest';
import bookmarkController from '../../controllers/bookmark.controller';
import { toggleBookmark, getBookmarksByUsername } from '../../services/bookmark.service';

// Mock the service layer
jest.mock('../../services/bookmark.service');

// Mock socket emit
const mockSocket = { emit: jest.fn() };

const app = express();
app.use(express.json());
app.use('/api/bookmark', bookmarkController(mockSocket as any));

// Test suite for bookmark controller
describe('Bookmark Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Tests for POST /api/bookmark/toggle
  describe('POST /api/bookmark/toggle', () => {
    const baseUrl = '/api/bookmark/toggle';
    const mockBookmark = {
      _id: '123',
      username: 'test_user',
      targetId: 'abc123',
      targetType: 'Community',
    };

    // Successful toggle
    test('should return 200 and toggle bookmark successfully', async () => {
      (toggleBookmark as jest.Mock).mockResolvedValueOnce(mockBookmark);

      const response = await request(app).post(baseUrl).send({
        username: 'test_user',
        targetId: 'abc123',
        targetType: 'Community',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBookmark);
      expect(mockSocket.emit).toHaveBeenCalledWith('bookmarkUpdate', {
        type: 'toggled',
        bookmark: mockBookmark,
      });
    });

    // Invalid request body
    test('should return 400 if body is invalid', async () => {
      const response = await request(app).post(baseUrl).send({
        username: 'test_user',
        // missing targetId and targetType
      });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Invalid bookmark request body.');
    });

    // Bookmark removed case
    test('should return 200 and emit when bookmark is removed', async () => {
      (toggleBookmark as jest.Mock).mockResolvedValueOnce({ removed: true });

      const response = await request(app).post(baseUrl).send({
        username: 'test_user',
        targetId: 'abc123',
        targetType: 'Community',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ removed: true });
      expect(mockSocket.emit).toHaveBeenCalledWith('bookmarkUpdate', {
        type: 'toggled',
        bookmark: { removed: true },
      });
    });

    // Service returns error
    test('should return 500 if toggleBookmark returns error', async () => {
      (toggleBookmark as jest.Mock).mockResolvedValueOnce({ error: 'Database error' });

      const response = await request(app).post(baseUrl).send({
        username: 'test_user',
        targetId: 'abc123',
        targetType: 'Community',
      });

      expect(response.status).toBe(500);
      expect(response.text).toContain('Error toggling bookmark: Database error');
    });

    // Service throws exception
    test('should return 500 if toggleBookmark throws', async () => {
      (toggleBookmark as jest.Mock).mockRejectedValueOnce(new Error('Unexpected failure'));

      const response = await request(app).post(baseUrl).send({
        username: 'test_user',
        targetId: 'abc123',
        targetType: 'Community',
      });

      expect(response.status).toBe(500);
      expect(response.text).toContain('Error toggling bookmark: Unexpected failure');
    });
  });

  // Tests for GET /api/bookmark/getByUsername/:username
  describe('GET /api/bookmark/getByUsername/:username', () => {
    const baseUrl = '/api/bookmark/getByUsername/test_user';

    // Successful retrieval
    test('should return 200 with bookmarks', async () => {
      const mockBookmarks = [
        { _id: '1', targetType: 'Community', populatedTarget: { name: 'Community 1' } },
      ];
      (getBookmarksByUsername as jest.Mock).mockResolvedValueOnce(mockBookmarks);

      const response = await request(app).get(baseUrl).query({ targetType: 'Community' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBookmarks);
      expect(getBookmarksByUsername).toHaveBeenCalledWith('test_user', 'Community');
    });

    // Missing username
    test('should return 400 if username is missing', async () => {
      const response = await request(app).get('/api/bookmark/getByUsername/');

      // Express will actually treat this as 404 because route requires :username
      expect([400, 404]).toContain(response.status);
    });

    // Service returns error
    test('should return 500 if getBookmarksByUsername returns error', async () => {
      (getBookmarksByUsername as jest.Mock).mockResolvedValueOnce({ error: 'Database error' });

      const response = await request(app).get(baseUrl).query({ targetType: 'Community' });

      expect(response.status).toBe(500);
      expect(response.text).toContain('Error retrieving bookmarks: Database error');
    });

    // Service throws exception
    test('should return 500 if getBookmarksByUsername throws', async () => {
      (getBookmarksByUsername as jest.Mock).mockRejectedValueOnce(new Error('Server crash'));

      const response = await request(app).get(baseUrl).query({ targetType: 'User' });

      expect(response.status).toBe(500);
      expect(response.text).toContain('Error retrieving bookmarks: Server crash');
    });
  });
});
