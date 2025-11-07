import { useState, useEffect, useCallback } from 'react';
import { getFollowers } from '../services/userService';
import { SafeDatabaseUser } from '../types/types';
import useUserContext from './useUserContext';

/**
 * Hook to fetch and manage the followers list for a user.
 *
 * @param username - The username to get followers for
 * @returns Object containing followers array, loading state, error, and refetch function
 */
const useFollowersList = (username: string) => {
  const { socket } = useUserContext();
  const [followers, setFollowers] = useState<SafeDatabaseUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchFollowers = useCallback(async () => {
    if (!username) return;

    try {
      setIsLoading(true);
      setError('');
      const data = await getFollowers(username);
      setFollowers(data);
    } catch (error) {
      setError('Failed to load followers');
      setFollowers([]);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers, socket]);

  return {
    followers,
    isLoading,
    error,
    refetch: fetchFollowers,
  };
};

export default useFollowersList;
