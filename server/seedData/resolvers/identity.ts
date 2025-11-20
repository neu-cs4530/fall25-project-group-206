import bcrypt from 'bcrypt';
import { InsertedDocs } from '../../types/populate';

// A generic shape for documents loaded from JSON seed files
export type SeedDocument = Record<string, unknown>;

const identityResolver = <T extends SeedDocument>(
  doc: SeedDocument,
  _insertedDocs: InsertedDocs,
  _collectionName: string,
): T => {
  // Detect a "user-like" document
  if (typeof doc.username === 'string' && typeof doc.password === 'string') {
    const newDoc: SeedDocument = { ...doc };

    try {
      newDoc.password = bcrypt.hashSync(doc.password, 10);
    } catch {
      // If hashing fails, keep original password
      newDoc.password = doc.password;
    }

    if (typeof newDoc.email !== 'string') {
      newDoc.email = `${doc.username}@example.com`;
    }

    return newDoc as T;
  }

  // Default: unchanged
  return doc as T;
};

export default identityResolver;
