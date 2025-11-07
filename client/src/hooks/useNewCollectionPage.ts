import { useState } from 'react';
import { PopulatedDatabaseCollection } from '../types/types';
import { createCollection } from '../services/collectionService';
import useUserContext from './useUserContext';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook for managing the state and actions of the New Collection page.
 * @returns an object containing the following:
 * - error: string | null - Error message if any
 * - collectionName: string - The name of the collection
 * - collectionDescription: string - The description of the collection
 * - isPrivate: boolean - Indicates if the collection is private
 * - handleCollectionNameChange: function - Function to handle changes in the collection name input
 * - handleCollectionDescriptionChange: function - Function to handle changes in the collection description input
 * - handleIsPrivateChange: function - Function to handle changes in the private checkbox
 * - handleCreateCollection: function - Function to handle the creation of the collection
 */
const useNewCollectionPage = () => {
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState<string>('');
  const [collectionDescription, setCollectionDescription] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);

  const handleCollectionNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCollectionName(event.target.value);
  };

  const handleCollectionDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCollectionDescription(event.target.value);
  };

  const handleIsPrivateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsPrivate(event.target.checked);
  };

  const handleCreateCollection = async () => {
    try {
      const collection: PopulatedDatabaseCollection = await createCollection({
        name: collectionName,
        description: collectionDescription,
        isPrivate,
        username: user.username,
        questions: [],
      });

      if (collection) {
        navigate(`/collections/${user.username}/${collection._id}`);
      }
    } catch (err) {
      setError('Error while creating collection: ' + (err as Error).message);
    }
  };

  return {
    error,
    collectionName,
    collectionDescription,
    isPrivate,
    handleCollectionNameChange,
    handleCollectionDescriptionChange,
    handleIsPrivateChange,
    handleCreateCollection,
  };
};

export default useNewCollectionPage;
