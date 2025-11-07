import axios from 'axios';
import { Collection, PopulatedDatabaseCollection } from '../types/types';

const COLLECTION_API_URL = '/api/collection';

/**
 * Creates a new collection.
 * @param collection - The collection object to be created
 * @returns {Promise<PopulatedDatabaseCollection>} - A promise that resolves to the created collection
 */
const createCollection = async (collection: Collection): Promise<PopulatedDatabaseCollection> => {
  const res = await axios.post(`${COLLECTION_API_URL}/create`, collection);

  if (res.status !== 200) {
    throw new Error('Error while creating collection');
  }

  return res.data;
};

/**
 * Fetches all collections for a given username.
 *
 * @param usernameToView - The username of the user whose collections we want to view
 * @param currentUsername - The username of the current user
 * @returns A promise that resolves to an array of collections
 */
const getAllCollectionsByUsername = async (
  usernameToView: string,
  currentUsername: string,
): Promise<PopulatedDatabaseCollection[]> => {
  const res = await axios.get(
    `${COLLECTION_API_URL}/getCollectionsByUsername/${usernameToView}?currentUsername=${currentUsername}`,
  );

  if (res.status !== 200) {
    throw new Error('Error while fetching all collections');
  }

  return res.data;
};

/**
 * Fetches a collection by its ID for a given username.
 * @param username - The username requesting to view a collection
 * @param collectionId - The ID of the collection to view
 * @returns A promise that resolves to the collection object
 */
const getCollectionById = async (
  username: string,
  collectionId: string,
): Promise<PopulatedDatabaseCollection> => {
  const res = await axios.get(
    `${COLLECTION_API_URL}/getCollectionById/${collectionId}?username=${username}`,
  );

  if (res.status !== 200) {
    throw new Error('Error while fetching collection');
  }

  return res.data;
};

/**
 * Toggles the save status of a question in a collection.
 * @param collectionId - The ID of the collection
 * @param questionId - The ID of the question to either save or unsave
 * @returns A promise that resolves to the updated collection object
 */
const toggleSaveQuestion = async (collectionId: string, questionId: string, username: string) => {
  const res = await axios.patch(`${COLLECTION_API_URL}/toggleSaveQuestion`, {
    collectionId,
    questionId,
    username,
  });

  if (res.status !== 200) {
    throw new Error('Error while toggling save question');
  }

  return res.data;
};

/**
 * Deletes a collection.
 *
 * This function sends a DELETE request to the API to delete a collection based on its ID and the `username`
 * of the user initiating the request.
 *
 * @param collectionId - The ID of the collection to be deleted
 * @param username - The username of the user performing the action
 * @returns A promise that resolves to the result of the delete operation
 * @throws An error if the API response status is not 200
 */
const deleteCollection = async (collectionId: string, username: string) => {
  const res = await axios.delete(
    `${COLLECTION_API_URL}/delete/${collectionId}?username=${username}`,
  );

  if (res.status !== 200) {
    throw new Error('Error while deleting collection');
  }

  return res.data;
};

export {
  getAllCollectionsByUsername,
  getCollectionById,
  toggleSaveQuestion,
  createCollection,
  deleteCollection,
};
