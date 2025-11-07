import { useNavigate } from 'react-router-dom';
import useUserContext from './useUserContext';
import { DatabaseCommunity } from '../types/types';

/**
 * Custom hook to manage the logic for viewing a community card.
 * @param community - The community object containing details about the community.
 * @param setError - Function to set an error message.
 * @returns An object containing the username of the user and a function to handle viewing the community.
 */
const useCommunityCard = (community: DatabaseCommunity, setError: (err: string | null) => void) => {
  const navigate = useNavigate();
  const { user } = useUserContext();

  const handleViewCommunity = () => {
    if (community.visibility === 'PUBLIC') {
      navigate(`/communities/${community._id}`);
      return;
    }

    if (community.visibility === 'PRIVATE' && community.participants.includes(user.username)) {
      navigate(`/communities/${community._id}`);
      return;
    } else {
      setError('This community is private. Please join to view.');
    }
  };

  return { username: user.username, handleViewCommunity };
};

export default useCommunityCard;
