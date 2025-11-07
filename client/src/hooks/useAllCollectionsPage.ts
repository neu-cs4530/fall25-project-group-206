import { useEffect, useState } from 'react';
import { CollectionUpdatePayload, PopulatedDatabaseCollection } from '../types/types';
import useUserContext from './useUserContext';
import { getAllCollectionsByUsername } from '../services/collectionService';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Custom hook to manage the state and logic for the "All Collections" page, including fetching collections,
 * creating a new collection, and navigating to collection details.
 *
 * @returns an object containing the following:
 * - `usernameBeingViewed`: The username of the user whose collections are being viewed.
 * - `collections`: The list of collections for the user.
 * - `handleCreateCollection`: A function to navigate to the create collection page.
 * - `handleViewCollection`: A function to navigate to the collection details page.
 */
const useAllCollectionsPage = () => {
  const { user: currentUser, socket } = useUserContext();
  const { username: usernameBeingViewed } = useParams();
  const [collections, setCollections] = useState<PopulatedDatabaseCollection[]>([]);
  const navigate = useNavigate();

  const handleCreateCollection = async () => {
    navigate('/new/collection');
    return;
  };

  const handleViewCollection = async (collectionId: string) => {
    navigate(`${collectionId}`);
    return;
  };

  useEffect(() => {
    const fetchCollections = async () => {
      if (usernameBeingViewed === undefined) {
        return;
      }

      setCollections(await getAllCollectionsByUsername(usernameBeingViewed, currentUser.username));
    };

    const handleCollectionUpdate = (collectionUpdate: CollectionUpdatePayload) => {
      switch (collectionUpdate.type) {
        case 'created':
          if (collectionUpdate.collection.username === usernameBeingViewed) {
            // Only add the collection if it belongs to the user being viewed
            setCollections(prevCollections => [...prevCollections, collectionUpdate.collection]);
          }
          break;
        case 'updated':
          // Handle collection update
          setCollections(prevCollections =>
            prevCollections.map(collection =>
              collection._id.toString() === collectionUpdate.collection._id.toString()
                ? { ...collection, ...collectionUpdate.collection }
                : collection,
            ),
          );
          break;
        case 'deleted':
          setCollections(prevCollections =>
            prevCollections.filter(
              collection =>
                collection._id.toString() !== collectionUpdate.collection._id.toString(),
            ),
          );
          break;
        default:
          break;
      }
    };

    fetchCollections();

    socket.on('collectionUpdate', handleCollectionUpdate);

    return () => {
      socket.off('collectionUpdate', handleCollectionUpdate);
    };
  }, [currentUser.username, socket, usernameBeingViewed]);

  return {
    usernameBeingViewed,
    collections,
    handleCreateCollection,
    handleViewCollection,
    isOwner: currentUser.username === usernameBeingViewed,
  };
};

export default useAllCollectionsPage;
