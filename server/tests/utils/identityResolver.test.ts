import bcrypt from 'bcrypt';
import identityResolver from '../../seedData/resolvers/identity';
import type { InsertedDocs } from '../../types/populate';

// Dummy InsertedDocs since the resolver does not use it
const insertedDocs = {} as InsertedDocs;

/**
 * A strongly-typed "user-like" object.
 *
 * This matches how identityResolver determines user docs:
 *   - has username: string
 *   - has password: string
 *   - email is optional
 * We also allow arbitrary extra fields via index signature.
 */
type UserLike = {
  username: string;
  password: string;
  email?: string;
  [key: string]: unknown;
};

describe('identityResolver', () => {
  test('returns non-user docs unchanged', () => {
    const doc = { title: 'Hello', body: 'World' };

    const result = identityResolver<typeof doc>(doc, insertedDocs, 'questions');

    expect(result).toEqual(doc);
  });

  test('detects user-like docs and hashes the password', () => {
    const doc: UserLike = { username: 'alice', password: 'plaintext' };

    const result = identityResolver<UserLike>(doc, insertedDocs, 'users');

    expect(result.username).toBe('alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.password).not.toBe('plaintext');
    expect(bcrypt.compareSync('plaintext', result.password as string)).toBe(true);
  });

  test('preserves an existing email for user-like docs', () => {
    const doc: UserLike = {
      username: 'bob',
      password: 'secret',
      email: 'bob@custom.com',
    };

    const result = identityResolver<UserLike>(doc, insertedDocs, 'users');

    expect(result.email).toBe('bob@custom.com');
  });

  test('does not modify other fields on user-like docs', () => {
    const doc: UserLike = {
      username: 'charlie',
      password: 'supersecret',
      role: 'moderator',
    };

    const result = identityResolver<UserLike>(doc, insertedDocs, 'users');

    expect(result.role).toBe('moderator');
    expect(bcrypt.compareSync('supersecret', result.password as string)).toBe(true);
  });

  test('falls back to original password if bcrypt throws', () => {
    jest.spyOn(bcrypt, 'hashSync').mockImplementationOnce(() => {
      throw new Error('bcrypt failure');
    });

    const doc: UserLike = { username: 'eve', password: 'pass123' };

    const result = identityResolver<UserLike>(doc, insertedDocs, 'users');

    expect(result.password).toBe('pass123'); // unchanged
    expect(result.email).toBe('eve@example.com');
  });

  test('returns a new object, not the original reference', () => {
    const doc: UserLike = { username: 'matt', password: '1234' };

    const result = identityResolver<UserLike>(doc, insertedDocs, 'users');

    expect(result).not.toBe(doc);
  });
});
