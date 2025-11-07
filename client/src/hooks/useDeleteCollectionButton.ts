import { useNavigate, useParams } from 'react-router-dom';
import { deleteCollection } from '../services/collectionService';
import useUserContext from './useUserContext';

/**
 * Custom hook to manage the state and behavior of the delete collection button.
 *
 * @returns An object containing the following:
 * - handleDeleteCollection - A function to handle the button click.
 */
const useDeleteCollectionButton = () => {
  const { user } = useUserContext();
  const navigate = useNavigate();
  const { username } = useParams();

  const handleDeleteCollection = async (collectionId: string) => {
    // Logic to delete the collection
    await deleteCollection(collectionId, user.username);
    navigate(`/collections/${username}`);
  };

  return {
    handleDeleteCollection,
  };
};

export default useDeleteCollectionButton;
