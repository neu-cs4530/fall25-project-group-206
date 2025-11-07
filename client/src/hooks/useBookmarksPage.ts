import { useEffect, useState } from 'react';
import { getBookmarksByUsername } from '../services/bookmarkService';
import { PopulatedDatabaseBookmark } from '@fake-stack-overflow/shared';
import useUserContext from './useUserContext';

/**
 * Custom hook for managing bookmarks data.
 * Automatically fetches bookmarks by type (Collection, Community, User).
 * Returns loading state and categorized bookmarks.
 *
 * @returns collections - Array of bookmarked collections.
 * @returns communities - Array of bookmarked communities.
 * @returns users - Array of bookmarked users.
 * @returns loading - Boolean indicating loading state.
 */
const useBookmarksPage = () => {
  const { user } = useUserContext();
  const [collections, setCollections] = useState<PopulatedDatabaseBookmark[]>([]);
  const [communities, setCommunities] = useState<PopulatedDatabaseBookmark[]>([]);
  const [users, setUsers] = useState<PopulatedDatabaseBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.username) return;

    const fetchAll = async () => {
      setLoading(true);
      const [col, com, usr] = await Promise.all([
        getBookmarksByUsername(user.username, 'Collection'),
        getBookmarksByUsername(user.username, 'Community'),
        getBookmarksByUsername(user.username, 'User'),
      ]);
      setCollections(col);
      setCommunities(com);
      setUsers(usr);
      setLoading(false);
    };

    fetchAll();
  }, [user?.username]);

  return { collections, communities, users, loading };
};

export default useBookmarksPage;
