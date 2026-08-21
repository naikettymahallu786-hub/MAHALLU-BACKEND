import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

if (!process.env.TEST_MONGODB_URI) {
  throw new Error(
    'TEST_MONGODB_URI is not set. Copy .env.test.example to .env.test and point it at a ' +
      'dedicated, disposable test database (never a dev/prod database) before running tests.',
  );
}

// Guard against ever running the destructive per-test cleanup below against a
// real database: the test DB name must self-identify as a test database.
const testDbName = new URL(process.env.TEST_MONGODB_URI.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'))
  .pathname.replace(/^\//, '');
if (!/test/i.test(testDbName)) {
  throw new Error(
    `Refusing to run tests against database "${testDbName}" — its name doesn't contain ` +
      '"test". This suite wipes all collections after every test; point TEST_MONGODB_URI at ' +
      'a dedicated test database instead.',
  );
}

// Route the app's normal connectDB() at the dedicated test database instead
// of whatever MONGODB_URI/MONGODB_URI_LOCAL happen to be set to locally.
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
delete process.env.MONGODB_URI_LOCAL;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { connectDB, disconnectDB } from '../config/database';
import { connectRedis, getRedisClient } from '../config/redis';

beforeAll(async () => {
  await connectDB();
  // connectRedis() tolerates being unreachable (logs a warning, doesn't
  // throw) — tests that don't care about blacklist behavior still work
  // via the no-op fallback in config/redis.ts if Redis isn't available.
  await connectRedis();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await disconnectDB();
  // Without this, the open Redis socket keeps this Jest worker's process
  // alive after all tests finish, hanging `npm test` indefinitely instead
  // of exiting.
  const redisClient = getRedisClient();
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
});
