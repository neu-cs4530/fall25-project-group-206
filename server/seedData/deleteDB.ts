import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URL = process.env.MONGODB_URI;
if (!MONGO_URL) {
  throw new Error('MONGODB_URI not set in environment variables');
}

/**
 * Clears all collections from the connected MongoDB database.
 *
 * @returns A Promise that resolves when the database has been cleared.
 */
const clearDatabase = async (): Promise<void> => {
  try {
    // Connect resolves when the connection is open
    await mongoose.connect(`${MONGO_URL}/fake_so`);

    // Drop the entire database
    await mongoose.connection.dropDatabase();
  } finally {
    // Always attempt to close the connection; safe even if already closed
    await mongoose.connection.close();
  }
};

clearDatabase().catch(err => {
  // Signal failure without logging
  process.exitCode = 1;
  throw err;
});
