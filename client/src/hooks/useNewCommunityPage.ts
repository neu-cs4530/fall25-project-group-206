import { useState } from 'react';
import { createCommunity } from '../services/communityService';
import useUserContext from './useUserContext';
import { useNavigate } from 'react-router-dom';

const useNewCommunityPage = () => {
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleNewCommunity = async () => {
    if (!name || !description) {
      setError('Name and description are required');
      return;
    }

    try {
      const createdCommunity = await createCommunity({
        name,
        description,
        visibility: isPublic ? 'PUBLIC' : 'PRIVATE',
        admin: user.username,
        participants: [user.username],
      });

      navigate(`/communities/${createdCommunity._id.toString()}`);
    } catch (err: unknown) {
      setError('Failed to create community: ' + (err as Error).message);
    }
  };

  return {
    name,
    setName,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    error,
    setError,
    handleNewCommunity,
  };
};

export default useNewCommunityPage;
