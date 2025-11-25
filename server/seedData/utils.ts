import path from 'path';
import fs from 'fs/promises';

import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { CollectionDocTypes, CollectionName } from './collectionDependencies';
import { InsertedDocs, ReferenceResolver } from '../types/populate';

/**
 * Computes the import order by performing a topological sort on collection dependencies.
 * @param dependencies - Map of collections to their dependencies.
 * @returns {CollectionName[]} - A valid import order with dependencies coming before dependents.
 * @throws {Error} - If a circular dependency is detected.
 */
export function computeImportOrder(
  dependencies: Record<CollectionName, readonly CollectionName[]>,
): CollectionName[] {
  const visited = new Set<CollectionName>();
  const processing = new Set<CollectionName>();

  // The resulting order
  const result: CollectionName[] = [];

  /**
   * Recursive helper function to visit a collection and its dependencies.
   * @param collection - The collection to visit.
   */
  function visit(collection: CollectionName): void {
    // If already processed, skip
    if (visited.has(collection)) {
      return;
    }

    // If currently processing, we have a cycle
    if (processing.has(collection)) {
      throw new Error(`Circular dependency detected involving ${collection}`);
    }

    // Mark as being processed
    processing.add(collection);

    // Process all dependencies first
    dependencies[collection].forEach(dependency => {
      visit(dependency as CollectionName);
    });

    // Mark as processed and add to result
    processing.delete(collection);
    visited.add(collection);
    result.push(collection);
  }

  // Visit each collection
  Object.keys(dependencies).forEach(collection => {
    visit(collection as CollectionName);
  });

  return result;
}

/**
 * Processes a collection by resolving references and inserting documents into MongoDB.
 * @param model - The Mongoose model corresponding to the collection.
 * @param resolver - The resolver function for handling references.
 * @param docs - The documents to process and insert.
 * @param insertedDocs - Map of already inserted documents for reference resolution.
 * @param collectionName - The name of the collection being processed.
 * @returns {Promise<void>} - A promise that resolves when all documents are processed.
 */
export async function processCollection<T, D, R = T>(
  model: mongoose.Model<D>,
  resolver: ReferenceResolver<T, R>,
  docs: Record<string, T>,
  insertedDocs: InsertedDocs,
  collectionName: string,
) {
  const entries = Object.entries(docs);
  const resolvedDocs = entries.map(([key, doc]) => {
    const resolved = resolver(doc, insertedDocs);
    return { key, resolved };
  });

  const inserted = (await model.insertMany(resolvedDocs.map(d => d.resolved))) as unknown as Array<
    D & { _id: ObjectId }
  >;

  inserted.forEach((doc, index) => {
    const { key } = resolvedDocs[index];
    insertedDocs[collectionName].set(key, doc._id);
  });
}

/**
 * Loads JSON data for a given collection from the corresponding file.
 * @param collectionName - The name of the collection to load data for.
 * @returns {Promise<Record<string, CollectionDocTypes[K]>>} - A promise resolving to the parsed JSON data.
 */
export async function loadJSON<K extends CollectionName>(
  collectionName: K,
): Promise<Record<string, CollectionDocTypes[K]>> {
  const dataDir = path.resolve(__dirname, './data');
  const filePath = path.join(dataDir, `${collectionName}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');

  return JSON.parse(raw);
}
