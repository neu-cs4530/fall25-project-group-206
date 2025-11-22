// FILE: client/src/hooks/useNotificationPreferencesPage.ts
import { useCallback, useEffect, useState } from 'react';
import useUserContext from './useUserContext';
import { getFollowing } from '../services/userService';
import { getBookmarksByUsername } from '../services/bookmarkService';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notificationService';
import type { NotificationPreferencesDTO, SafeDatabaseUser } from '../types/types';
import type { PopulatedDatabaseBookmark } from '@fake-stack-overflow/shared';

export interface FriendOption {
  username: string;
}

export interface CommunityOption {
  id: string;
  name: string;
}

export interface CollectionOption {
  id: string;
  name: string;
}

interface UseNotificationPreferencesPageResult {
  prefs: NotificationPreferencesDTO | null;
  friends: FriendOption[];
  bookmarkedCommunities: CommunityOption[];
  bookmarkedCollections: CollectionOption[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (next: NotificationPreferencesDTO) => Promise<void>;
}

/**
 * Helper: turn a bookmark.targetId (ObjectId|string) into a string.
 */
const toIdString = (value: PopulatedDatabaseBookmark['targetId']): string => {
  if (typeof value === 'string') {
    return value;
  }
  return (value as unknown as { toString: () => string }).toString();
};

/**
 * Helper: extract a name from populatedTarget, with a fallback.
 */
const getBookmarkName = (bookmark: PopulatedDatabaseBookmark, fallbackPrefix: string): string => {
  const target = bookmark.populatedTarget;
  if (target && typeof target.name === 'string' && target.name.trim().length > 0) {
    return target.name;
  }
  if (target && typeof target.username === 'string' && target.username.trim().length > 0) {
    return target.username;
  }
  const idStr = toIdString(bookmark.targetId);
  return `${fallbackPrefix} ${idStr}`;
};

const useNotificationPreferencesPage = (): UseNotificationPreferencesPageResult => {
  const { user } = useUserContext();

  const [prefs, setPrefs] = useState<NotificationPreferencesDTO | null>(null);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [bookmarkedCommunities, setBookmarkedCommunities] = useState<CommunityOption[]>([]);
  const [bookmarkedCollections, setBookmarkedCollections] = useState<CollectionOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const username = user?.username ?? '';

  const refetch = useCallback(async () => {
    if (!username) {
      setPrefs(null);
      setFriends([]);
      setBookmarkedCommunities([]);
      setBookmarkedCollections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) Notification preferences
      const prefData = await fetchNotificationPreferences(username);
      setPrefs(prefData);

      // 2) Friends = "following" list
      const followingUsers: SafeDatabaseUser[] = await getFollowing(username);
      setFriends(
        followingUsers
          .filter(u => typeof u.username === 'string')
          .map(u => ({ username: u.username })),
      );

      // 3) Bookmarked communities
      const communityBookmarks = await getBookmarksByUsername(username, 'Community');
      setBookmarkedCommunities(
        communityBookmarks.map((b: PopulatedDatabaseBookmark) => ({
          id: toIdString(b.targetId),
          name: getBookmarkName(b, 'Community'),
        })),
      );

      // 4) Bookmarked collections
      const collectionBookmarks = await getBookmarksByUsername(username, 'Collection');
      setBookmarkedCollections(
        collectionBookmarks.map((b: PopulatedDatabaseBookmark) => ({
          id: toIdString(b.targetId),
          name: getBookmarkName(b, 'Collection'),
        })),
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = useCallback(
    async (next: NotificationPreferencesDTO) => {
      if (!username) {
        return;
      }

      setSaving(true);
      setError(null);
      try {
        const updated = await updateNotificationPreferences(username, next);
        setPrefs(updated);
      } catch (err) {
        setError((err as Error).message || 'Failed to save notification preferences');
      } finally {
        setSaving(false);
      }
    },
    [username],
  );

  return {
    prefs,
    friends,
    bookmarkedCommunities,
    bookmarkedCollections,
    loading,
    saving,
    error,
    refetch,
    save,
  };
};

export default useNotificationPreferencesPage;
