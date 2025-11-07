import { useState, useEffect } from 'react';
import { toggleFollowUser } from '../services/userService';
import useUserContext from './useUserContext';
import useLoginContext from './useLoginContext';

/**
 * Hook to manage follow/unfollow functionality for a specific user.
 *
 * @param targetUsername - The username to follow/unfollow
 * @param initialIsFollowing - Whether the current user is already following the target
 * @returns Object containing toggle function, loading state, error, and current follow status
 */
const useFollowButton = (targetUsername: string, initialIsFollowing: boolean) => {
  const { user: currentUser } = useUserContext();
  const { setUser } = useLoginContext();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleToggleFollow = async (): Promise<boolean> => {
    if (currentUser.username === targetUsername) {
      setError('You cannot follow yourself');
      return isFollowing;
    }

    try {
      setIsLoading(true);
      setError('');

      const updatedUser = await toggleFollowUser(currentUser.username, targetUsername);

      // Toggle the local state
      setIsFollowing(!isFollowing);

      // If the server returned an updated current user, update the global user
      if (updatedUser) {
        setUser(updatedUser);
      }

      // Return the new state to callers so they can update UI immediately
      return !isFollowing;
    } catch (error) {
      setError(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user`);
      return isFollowing;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  return {
    isFollowing,
    isLoading,
    error,
    handleToggleFollow,
  };
};

export default useFollowButton;
