import { useEffect, useState } from 'react';
import { CollectionUpdatePayload, PopulatedDatabaseCollection } from '../types/types';
import { useNavigate, useParams } from 'react-router-dom';
import { getCollectionById } from '../services/collectionService';
import useUserContext from './useUserContext';

/**
 * Custom hook to manage the state and behavior of the collection page.
 *
 * @returns An object containing the following:
 * - collection: The collection object fetched from the server
 * - isOwner - Whether the user viewing the page owns the collections
 */
const useCollectionPage = () => {
  const { user: currentUser, socket } = useUserContext();
  const [collection, setCollection] = useState<PopulatedDatabaseCollection | null>(null);
  const { username, collectionId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCollection = async () => {
      if (!username || !collectionId) {
        return;
      }

      const collection = await getCollectionById(username, collectionId);
      setCollection(collection);
    };

    const handleCollectionUpdate = (collectionUpdate: CollectionUpdatePayload) => {
      switch (collectionUpdate.type) {
        case 'created':
          break;
        case 'updated':
          // Handle collection update
          if (collectionUpdate.collection._id.toString() === collectionId) {
            setCollection(collectionUpdate.collection);
          }
          break;
        case 'deleted':
          if (collectionUpdate.collection._id.toString() === collectionId) {
            navigate(-1); // Go back to the previous page
          }
          break;
        default:
          break;
      }
    };

    fetchCollection();

    socket.on('collectionUpdate', handleCollectionUpdate);

    return () => {
      socket.off('collectionUpdate', handleCollectionUpdate);
    };
  }, [username, collectionId, socket, navigate]);

  return {
    collection,
    isOwner: currentUser.username === username,
  };
};

export default useCollectionPage;
