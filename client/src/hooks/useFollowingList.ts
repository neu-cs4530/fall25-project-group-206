import { useState, useEffect, useCallback } from 'react';
import { getFollowing } from '../services/userService';
import { SafeDatabaseUser } from '../types/types';
import useUserContext from './useUserContext';

/**
 * Hook to fetch and manage the following list for a user.
 *
 * @param username - The username to get following list for
 * @returns Object containing following array, loading state, error, and refetch function
 */
const useFollowingList = (username: string) => {
  const { socket } = useUserContext();
  const [following, setFollowing] = useState<SafeDatabaseUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchFollowing = useCallback(async () => {
    if (!username) return;

    try {
      setIsLoading(true);
      setError('');
      const data = await getFollowing(username);
      setFollowing(data);
    } catch (error) {
      setError('Failed to load following');
      setFollowing([]);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchFollowing();
  }, [fetchFollowing, socket]);

  return {
    following,
    isLoading,
    error,
    refetch: fetchFollowing,
  };
};

export default useFollowingList;
