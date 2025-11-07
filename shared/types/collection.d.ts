import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { Question } from './question';

/**
 * Represents a collection.
 * - `name`: The name of the collection.
 * - `description`: The description of the collection.
 * - `questions`: The questions that have been added to the collection.
 */
export interface Collection {
  name: string;
  description?: string;
  questions: Question[];
  isPrivate: boolean;
  username: string;
}

/**
 * Represents a collection stored in the database.
 * - `_id`: The unique identifier of the collection.
 * - `questions`: The questions that have been added to the collection.
 */
export interface DatabaseCollection extends Omit<Collection, 'questions'> {
  _id: ObjectId;
  questions: ObjectId[];
}

/**
 * Represents a response for a collection operation.
 * - Either a `DatabaseCollection` object or an error message.
 */
export type CollectionResponse = DatabaseCollection | { error: string };

export interface PopulatedDatabaseCollection extends Omit<DatabaseCollection, 'questionId'> {
  questions: PopulatedDatabaseQuestion[];
}

/**
 * Represents a request to create a collection.
 * - `name`: The name of the collection.
 * - `description`: The description of the collection.
 * - `questions`: The questions that have been added to the collection.
 */
export interface CreateCollectionRequest extends Request {
  body: Collection;
}

/**
 * Represents a request to get collections by id.
 * - `collectionId`: The unique identifier of the collection.
 */

export interface CollectionRequest extends Request {
  params: {
    collectionId: string;
  };
  query: {
    username: string;
  };
}

/**
 * Represents a request to add a question to a collection.
 * - `id`: The unique identifier of the collection.
 * - `questionId`: The unique identifier of the question.
 */
export interface SaveQuestionRequest extends CollectionRequest {
  body: {
    collectionId: string;
    questionId: string;
    username: string;
  };
}

/**
 * Represents a request to get collections by user id.
 * - `username`: The unique identifier of the user  .
 */
export interface GetCollectionsByUserIdRequest extends Request {
  params: {
    username: string;
  };
  query: {
    currentUsername: string;
  };
}
