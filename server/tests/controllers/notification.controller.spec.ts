// FILE: server/tests/controllers/notification.controller.spec.ts
import supertest from 'supertest';
import { app } from '../../app';

import * as feedService from '../../services/notificationFeed.service';
import * as prefsService from '../../services/notificationPreferences.service';
import notificationController from '../../controllers/notification.controller';

// Reuse the realtime mock pattern so importing app is safe if it pulls in socket wiring.
jest.mock('../../utils/realtime', () => {
  const emitMock = jest.fn();
  const registerSocketServerMock = jest.fn();

  return {
    __esModule: true,
    default: emitMock,
    registerSocketServer: registerSocketServerMock,
  };
});

const buildNotificationFeedForUserSpy = jest.spyOn(feedService, 'buildNotificationFeedForUser');
const buildNotificationDigestForUserSpy = jest.spyOn(feedService, 'buildNotificationDigestForUser');
const getPreferencesDTOSpy = jest.spyOn(prefsService, 'getPreferencesDTO');
const updatePreferencesForUserSpy = jest.spyOn(prefsService, 'updatePreferencesForUser');

describe('notificationController', () => {
  const username = 'user1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notification/feed/:username', () => {
    it('returns notification feed for a valid username', async () => {
      const mockFeed = [
        {
          id: 'n1',
          message: 'Test notification',
        },
      ] as any;

      buildNotificationFeedForUserSpy.mockResolvedValueOnce(mockFeed);

      const res = await supertest(app).get(`/api/notification/feed/${username}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockFeed);
      expect(buildNotificationFeedForUserSpy).toHaveBeenCalledWith(username);
    });

    it('returns 500 when service returns an error object', async () => {
      buildNotificationFeedForUserSpy.mockResolvedValueOnce({
        error: 'Error building feed',
      } as any);

      const res = await supertest(app).get(`/api/notification/feed/${username}`);

      expect(res.status).toBe(500);
      expect(res.text).toContain('Error building notification feed: Error building feed');
      expect(buildNotificationFeedForUserSpy).toHaveBeenCalledWith(username);
    });
  });

  describe('GET /api/notification/preferences/:username', () => {
    it('returns preferences DTO for a valid username', async () => {
      const mockPrefs = {
        globalDndEnabled: false,
        silentHoursEnabled: false,
      } as any;

      getPreferencesDTOSpy.mockResolvedValueOnce(mockPrefs);

      const res = await supertest(app).get(`/api/notification/preferences/${username}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPrefs);
      expect(getPreferencesDTOSpy).toHaveBeenCalledWith(username);
    });

    it('returns 500 when getPreferencesDTO throws', async () => {
      getPreferencesDTOSpy.mockRejectedValueOnce(new Error('prefs-fail'));

      const res = await supertest(app).get(`/api/notification/preferences/${username}`);

      expect(res.status).toBe(500);
      expect(res.text).toContain('Error fetching notification preferences: prefs-fail');
      expect(getPreferencesDTOSpy).toHaveBeenCalledWith(username);
    });
  });

  describe('GET /api/notification/digest/:username', () => {
    it('returns notification digest for a valid username', async () => {
      const mockDigest = {
        high: [],
        normal: [],
        low: [],
        muted: [],
      } as any;

      buildNotificationDigestForUserSpy.mockResolvedValueOnce(mockDigest);

      const res = await supertest(app).get(`/api/notification/digest/${username}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDigest);
      expect(buildNotificationDigestForUserSpy).toHaveBeenCalledWith(username);
    });

    it('returns 500 when service returns an error object', async () => {
      buildNotificationDigestForUserSpy.mockResolvedValueOnce({
        error: 'Error building digest',
      } as any);

      const res = await supertest(app).get(`/api/notification/digest/${username}`);

      expect(res.status).toBe(500);
      expect(res.text).toContain('Error building notification digest: Error building digest');
      expect(buildNotificationDigestForUserSpy).toHaveBeenCalledWith(username);
    });
  });

  describe('PUT /api/notification/preferences/:username', () => {
    it('updates preferences and returns the updated DTO', async () => {
      const updateBody = {
        globalDndEnabled: true,
        silentHoursEnabled: false,
      } as any;

      const updatedPrefs = {
        ...updateBody,
        someOtherField: 'value',
      } as any;

      updatePreferencesForUserSpy.mockResolvedValueOnce(updatedPrefs);

      const res = await supertest(app)
        .put(`/api/notification/preferences/${username}`)
        .send(updateBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedPrefs);
      expect(updatePreferencesForUserSpy).toHaveBeenCalledWith(username, updateBody);
    });

    it('returns 500 when updatePreferencesForUser throws', async () => {
      const updateBody = {
        globalDndEnabled: false,
      } as any;

      updatePreferencesForUserSpy.mockRejectedValueOnce(new Error('update-fail'));

      const res = await supertest(app)
        .put(`/api/notification/preferences/${username}`)
        .send(updateBody);

      expect(res.status).toBe(500);
      expect(res.text).toContain('Error updating notification preferences: update-fail');
      expect(updatePreferencesForUserSpy).toHaveBeenCalledWith(username, updateBody);
    });
  });

  //
  // Explicit tests for the `if (!username)` guard clauses inside the router handlers.
  // These cannot be hit via supertest because Express never routes to /:username handlers
  // without a path segment, so we call the handlers directly off the router stack.
  //
  describe('username guard clauses (direct handler calls)', () => {
    // Build a router instance the same way app.ts does, but with a fake socket.
    const router = notificationController({} as any);

    const getGetHandler = (path: string) => {
      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === path && l.route?.methods.get,
      );
      if (!layer) {
        throw new Error(`Route not found for GET ${path}`);
      }
      return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
    };

    const getPutHandler = (path: string) => {
      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === path && l.route?.methods.put,
      );
      if (!layer) {
        throw new Error(`Route not found for PUT ${path}`);
      }
      return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
    };

    const makeRes = () => {
      const res: any = {};
      res.status = jest.fn().mockReturnValue(res);
      res.send = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    it('returns 400 and message when username is falsy for feed route', async () => {
      const handler = getGetHandler('/feed/:username');
      const req = { params: { username: '' } };
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing username in request.');
    });

    it('returns 400 and message when username is falsy for preferences GET route', async () => {
      const handler = getGetHandler('/preferences/:username');
      const req = { params: { username: '' } };
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing username in request.');
    });

    it('returns 400 and message when username is falsy for digest route', async () => {
      const handler = getGetHandler('/digest/:username');
      const req = { params: { username: '' } };
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing username in request.');
    });

    it('returns 400 and message when username is falsy for preferences PUT route', async () => {
      const handler = getPutHandler('/preferences/:username');
      const req = {
        params: { username: '' },
        body: { globalDndEnabled: true },
      };
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing username in request.');
    });
  });
});
