import { useState } from 'react';
import { ObjectId } from 'mongodb';
import useUserContext from './useUserContext';
import { changeCommunityMembership } from '../services/communityService';

/**
 * Custom hook to manage the logic for joining or leaving a community.
 * @returns An object containing:
 * - `username`: The username of the user.
 * - `handleCommunityMembership`: A function to handle joining or leaving a community.
 * - `error`: An error message if any error occurs during the process.
 */
const useCommunityMembershipButton = () => {
  const { user } = useUserContext();
  const [error, setError] = useState<string | null>(null);

  const handleCommunityMembership = async (communityId: ObjectId) => {
    try {
      await changeCommunityMembership(communityId, user.username);
    } catch (err: unknown) {
      setError('Failed to change community membership');
    }
  };

  return { username: user.username, handleCommunityMembership, error };
};
export default useCommunityMembershipButton;
