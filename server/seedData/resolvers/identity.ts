import bcrypt from 'bcrypt';
import { InsertedDocs } from '../../types/populate';

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
const identityResolver = <T>(doc: any, _insertedDocs: InsertedDocs, _collectionName: string): T => {
  // Special-case: looks like a User document
  if (doc && typeof doc.username === 'string' && typeof doc.password === 'string') {
    const newDoc = { ...doc };

    // Hash password synchronously so this resolver stays sync
    try {
      newDoc.password = bcrypt.hashSync(newDoc.password, 10);
    } catch (err) {
      console.error('[identityResolver] Error hashing password for', newDoc.username, err);
      // If hashing fails for some reason, fall back to original password
      // so populate-db can still complete.
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
