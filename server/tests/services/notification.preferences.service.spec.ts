// server/tests/services/notificationPreferences.service.spec.ts
import mongoose from 'mongoose';
import NotificationPreferencesModel, {
  NotificationPreferences,
} from '../../models/notificationPreference.model';
import UserModel from '../../models/users.model';
import QuestionModel from '../../models/questions.model';
import CollectionModel from '../../models/collection.model';
import type { NotificationItem, DatabaseUser, NotificationLocation } from '../../types/types';

import * as NotificationPreferencesService from '../../services/notificationPreferences.service';

function createBasePrefs(
  overrides: Partial<NotificationPreferences> = {},
): NotificationPreferences {
  return {
    user: new mongoose.Types.ObjectId(),
    mutedUsers: [],
    mutedCommunities: [],
    mutedCollections: [],
    perCategoryLocation: new Map(),
    perCategory: new Map(),
    perLocation: new Map(),
    defaultPriority: 'normal',
    dndEnabled: false,
    silentHours: { start: null, end: null },
    muteHighGroups: false,
    muteNormalGroups: false,
    muteLowGroups: false,
    ...overrides,
  } as any;
}

function createNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  // valid NotificationLocation options from schema:
  // 'collection', 'community', 'collection/community', 'following', 'direct'
  return {
    actor: 'alice',
    message: 'test message',
    eventDate: new Date(),
    targetId: new mongoose.Types.ObjectId(),
    targetType: 'Question',
    location: 'collection',
    category: 'question',
    link: '/question/123',
    ...overrides,
  } as NotificationItem;
}

describe('notificationPreferences.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolvePriorityForNotification', () => {
    it('resolves the highest priority across category/location/sources', () => {
      // Use valid category + locations only
      const prefs = createBasePrefs({
        perCategoryLocation: new Map([['question:direct', 'high']]),
        perCategory: new Map([['question', 'normal']]),
        perLocation: new Map<NotificationLocation, any>([
          ['collection', 'low'],
          ['direct', 'low'],
        ]),
        defaultPriority: 'low',
      });

      const notification = createNotification({
        // primary location
        location: 'collection',
        // extra sources; needs to be NotificationLocation[]
        sources: ['direct'],
      });

      const result = NotificationPreferencesService.resolvePriorityForNotification(
        notification,
        prefs,
      );

      // Because category+location 'question:direct' is mapped to 'high'
      expect(result).toBe('high');
    });

    it('falls back to default priority when no specific rules exist', () => {
      const prefs = createBasePrefs({
        perCategoryLocation: new Map(),
        perCategory: new Map(),
        perLocation: new Map(),
        defaultPriority: 'normal',
      });

      // Use valid category/location, but no entries in maps
      const notification = createNotification({
        location: 'direct',
        category: 'question',
      });

      const result = NotificationPreferencesService.resolvePriorityForNotification(
        notification,
        prefs,
      );

      expect(result).toBe('normal');
    });
  });

  describe('isNotificationMuted', () => {
    it('returns true when global DND is enabled', async () => {
      const prefs = createBasePrefs({
        dndEnabled: true,
      });

      const notification = createNotification();

      const questionSpy = jest.spyOn(QuestionModel, 'findById');
      const collectionSpy = jest.spyOn(CollectionModel, 'find');

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(true);
      expect(questionSpy).not.toHaveBeenCalled();
      expect(collectionSpy).not.toHaveBeenCalled();
    });

    it('returns true during non-wrapping silent hours', async () => {
      const prefs = createBasePrefs({
        silentHours: { start: '09:00', end: '17:00' },
      });

      const notification = createNotification();

      const getHoursSpy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      const getMinutesSpy = jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(true);

      getHoursSpy.mockRestore();
      getMinutesSpy.mockRestore();
    });

    it('returns true during wrapping silent hours across midnight', async () => {
      const prefs = createBasePrefs({
        silentHours: { start: '22:00', end: '07:00' },
      });

      const notification = createNotification();

      const getHoursSpy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
      const getMinutesSpy = jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(true);

      getHoursSpy.mockRestore();
      getMinutesSpy.mockRestore();
    });

    it('returns false when silent hours configuration is invalid', async () => {
      const prefs = createBasePrefs({
        silentHours: { start: 'bad', end: '07:00' },
      });

      const notification = createNotification();

      const getHoursSpy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(1);
      const getMinutesSpy = jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(false);

      getHoursSpy.mockRestore();
      getMinutesSpy.mockRestore();
    });

    it('returns true when actor is muted', async () => {
      const prefs = createBasePrefs({
        mutedUsers: ['alice'],
      });

      const notification = createNotification({ actor: 'alice' });

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(true);
    });

    it('returns true when the question belongs to a muted community', async () => {
      const communityId = new mongoose.Types.ObjectId();
      const questionId = new mongoose.Types.ObjectId();

      const prefs = createBasePrefs({
        mutedCommunities: [communityId],
        mutedCollections: [],
      });

      const notification = createNotification({
        targetType: 'Question',
        targetId: questionId as any,
      });

      jest.spyOn(QuestionModel, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ community: communityId }),
      } as any);

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(true);
      expect(QuestionModel.findById).toHaveBeenCalledWith(questionId);
    });

    it('returns true when the question is in a muted collection', async () => {
      const collectionId = new mongoose.Types.ObjectId();
      const questionId = new mongoose.Types.ObjectId();

      const prefs = createBasePrefs({
        mutedCommunities: [],
        mutedCollections: [collectionId],
      });

      const notification = createNotification({
        targetType: 'Question',
        targetId: questionId as any,
      });

      jest.spyOn(CollectionModel, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: collectionId,
          },
        ]),
      } as any);

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(true);
      expect(CollectionModel.find).toHaveBeenCalledTimes(1);
    });

    it('returns false when there are no mute rules and no silent conditions', async () => {
      const prefs = createBasePrefs({
        mutedUsers: [],
        mutedCommunities: [],
        mutedCollections: [],
        silentHours: { start: null, end: null },
        dndEnabled: false,
      });

      const notification = createNotification();

      const result = await NotificationPreferencesService.isNotificationMuted(notification, prefs);

      expect(result).toBe(false);
    });
  });

  describe('getOrCreatePreferences', () => {
    it('returns ephemeral defaults when the user does not exist', async () => {
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const prefs = await NotificationPreferencesService.getOrCreatePreferences('missing-user');

      expect(prefs.mutedUsers).toEqual([]);
      expect(prefs.dndEnabled).toBe(false);
      expect(prefs.silentHours).toEqual({ start: null, end: null });
    });

    it('returns existing preferences when a document already exists', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dbUser: DatabaseUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const existingPrefs = createBasePrefs({
        user: userId,
        mutedUsers: ['bob'],
      });

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      } as any);

      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingPrefs),
      } as any);

      const prefs = await NotificationPreferencesService.getOrCreatePreferences('alice');

      expect(prefs).toBe(existingPrefs);
      expect(prefs.mutedUsers).toContain('bob');
    });

    it('creates new preferences when none exist for an existing user', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dbUser: DatabaseUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const createdPrefs = createBasePrefs({
        user: userId,
      });

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      } as any);

      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const createSpy = jest.spyOn(NotificationPreferencesModel, 'create');
      createSpy.mockResolvedValue(createdPrefs as any);

      const prefs = await NotificationPreferencesService.getOrCreatePreferences('alice');

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(prefs).toBe(createdPrefs);
    });
  });

  describe('getPreferencesDTO', () => {
    it('converts maps and ObjectIds to plain DTO fields', async () => {
      const commId = new mongoose.Types.ObjectId();
      const collId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const dbUser: DatabaseUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const prefsDoc = createBasePrefs({
        user: userId,
        mutedUsers: ['bob'],
        mutedCommunities: [commId],
        mutedCollections: [collId],
        perCategoryLocation: new Map([['question:collection', 'high']]),
        perCategory: new Map([['question', 'normal']]),
        perLocation: new Map([['collection', 'low']]),
        defaultPriority: 'normal',
        dndEnabled: true,
        silentHours: { start: '22:00', end: '07:00' },
        muteHighGroups: true,
        muteNormalGroups: false,
        muteLowGroups: false,
      });

      // Make real getOrCreatePreferences() see an existing user and prefs
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      } as any);

      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(prefsDoc),
      } as any);

      const dto = await NotificationPreferencesService.getPreferencesDTO('alice');

      expect(dto.mutedUsers).toEqual(['bob']);
      expect(dto.mutedCommunities).toEqual([commId.toString()]);
      expect(dto.mutedCollections).toEqual([collId.toString()]);
      expect(dto.perCategoryLocation).toEqual({ 'question:collection': 'high' });
      expect(dto.perCategory).toEqual({ question: 'normal' });
      expect(dto.perLocation).toEqual({ collection: 'low' });
      expect(dto.defaultPriority).toBe('normal');
      expect(dto.dndEnabled).toBe(true);
      expect(dto.silentHours).toEqual({ start: '22:00', end: '07:00' });
      expect(dto.muteHighGroups).toBe(true);
    });
  });

  describe('updatePreferencesForUser', () => {
    it('throws when the user does not exist', async () => {
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        NotificationPreferencesService.updatePreferencesForUser('missing-user', {
          mutedUsers: ['bob'],
        }),
      ).rejects.toThrow('User "missing-user" not found');
    });

    it('creates and updates preferences when no document exists', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dbUser: DatabaseUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const commId = new mongoose.Types.ObjectId().toString();
      const collId = new mongoose.Types.ObjectId().toString();

      const prefsDoc: any = {
        user: userId,
        mutedUsers: [],
        mutedCommunities: [],
        mutedCollections: [],
        perCategoryLocation: new Map(),
        perCategory: new Map(),
        perLocation: new Map(),
        defaultPriority: 'normal',
        dndEnabled: false,
        silentHours: { start: null, end: null },
        muteHighGroups: false,
        muteNormalGroups: false,
        muteLowGroups: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      } as any);

      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const createSpy = jest.spyOn(NotificationPreferencesModel, 'create');
      createSpy.mockResolvedValue(prefsDoc as any);

      const dto = await NotificationPreferencesService.updatePreferencesForUser('alice', {
        mutedUsers: ['u1', 'u2'],
        mutedCommunities: [commId],
        mutedCollections: [collId],
        perCategoryLocation: { 'question:collection': 'high' },
        perCategory: { question: 'normal' },
        perLocation: { collection: 'low' },
        defaultPriority: 'normal',
        dndEnabled: true,
        silentHours: { start: '22:00', end: '07:00' },
        muteHighGroups: true,
        muteNormalGroups: true,
        muteLowGroups: false,
      });

      expect(prefsDoc.save).toHaveBeenCalledTimes(1);

      expect(dto.mutedUsers).toEqual(['u1', 'u2']);
      expect(dto.mutedCommunities).toEqual([commId]);
      expect(dto.mutedCollections).toEqual([collId]);
      expect(dto.perCategoryLocation).toEqual({ 'question:collection': 'high' });
      expect(dto.perCategory).toEqual({ question: 'normal' });
      expect(dto.perLocation).toEqual({ collection: 'low' });
      expect(dto.dndEnabled).toBe(true);
      expect(dto.silentHours).toEqual({ start: '22:00', end: '07:00' });
      expect(dto.muteHighGroups).toBe(true);
      expect(dto.muteNormalGroups).toBe(true);
      expect(dto.muteLowGroups).toBe(false);
    });

    it('sets silentHours to null in the DTO when updated with null', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dbUser: DatabaseUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashed',
        dateJoined: new Date(),
        followers: [],
        following: [],
      } as any;

      const prefsDoc: any = {
        user: userId,
        mutedUsers: [],
        mutedCommunities: [],
        mutedCollections: [],
        perCategoryLocation: new Map(),
        perCategory: new Map(),
        perLocation: new Map(),
        defaultPriority: 'normal',
        dndEnabled: false,
        silentHours: { start: '09:00', end: '17:00' },
        muteHighGroups: false,
        muteNormalGroups: false,
        muteLowGroups: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      } as any);

      jest.spyOn(NotificationPreferencesModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(prefsDoc),
      } as any);

      const dto = await NotificationPreferencesService.updatePreferencesForUser('alice', {
        silentHours: null,
      });

      expect(prefsDoc.save).toHaveBeenCalledTimes(1);

      expect(prefsDoc.silentHours).toEqual({ start: null, end: null });
      expect(dto.silentHours).toBeNull();
    });
  });
});
