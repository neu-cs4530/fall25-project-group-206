import { PopulatedDatabaseCollection, PopulatedDatabaseQuestion } from '../types/types';
import { getAllCollectionsByUsername, toggleSaveQuestion } from '../services/collectionService';
import { useEffect, useState } from 'react';
import useUserContext from './useUserContext';

/**
 * Custom hook to manage saving questions to collections.
 * It fetches the user's collections and provides a function to save or unsave a question.
 *
 * @param question The question to be saved to a collection
 * @returns An object containing the following:
 * - collections: An array of collections that the user has
 * - handleToggleSave: A function to save or unsave a question in a collection
 */
const useSaveToCollectionModal = (question: PopulatedDatabaseQuestion) => {
  const [collections, setCollections] = useState<PopulatedDatabaseCollection[]>([]);
  const { user } = useUserContext();

  useEffect(() => {
    const fetchCollections = async () => {
      const result = await getAllCollectionsByUsername(user.username, user.username);
      setCollections(result);
    };
    fetchCollections();
  }, [user.username]);

  const handleToggleSave = async (collectionId: string) => {
    await toggleSaveQuestion(collectionId, question._id.toString(), user.username);

    const updatedCollections = await getAllCollectionsByUsername(user.username, user.username);
    setCollections(updatedCollections);
  };

  return {
    collections,
    handleToggleSave,
  };
};

export default useSaveToCollectionModal;
