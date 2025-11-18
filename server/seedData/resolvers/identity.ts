import bcrypt from 'bcrypt';
import { InsertedDocs } from '../../types/populate';
import { User } from '@fake-stack-overflow/shared';

/**
 * Identity resolver.
 *
 * For most collections:
 *   - returns the document unchanged.
 *
 * For "user-like" docs (those with username + password fields):
 *   - hashes the password
 *   - ensures an email field exists
 */
const identityResolver = <T extends object>(
  doc: T,
  _insertedDocs: InsertedDocs,
  _collectionName: string,
): T => {
  // Special-case: looks like a User document
  if (
    'username' in doc &&
    typeof doc.username === 'string' &&
    'password' in doc &&
    typeof doc.password === 'string'
  ) {
    const newDoc = { ...doc } as T & User;

    // Hash password synchronously so this resolver stays sync
    try {
      newDoc.password = bcrypt.hashSync(newDoc.password, 10);
    } catch {
      newDoc.password = doc.password as string;
    }

    // Add default email if missing
    if (!newDoc.email) {
      newDoc.email = `${newDoc.username}@example.com`;
    }

    return newDoc as T;
  }

  // Default: return the document unchanged
  return doc as T;
};

export default identityResolver;
