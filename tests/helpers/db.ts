import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongo: MongoMemoryServer | null = null

/**
 * Start an in-memory MongoDB instance and connect mongoose. Call once in a
 * `beforeAll` block. The first call binds the instance to MONGODB_URI so any
 * code that reads the env (like lib/db.ts) connects to the same DB.
 */
export async function startTestDb(): Promise<string> {
  if (mongo) return mongo.getUri()
  mongo = await MongoMemoryServer.create()
  const uri = mongo.getUri()
  process.env.MONGODB_URI = uri
  // Skip if production lib/db already connected — tests will re-connect.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  await mongoose.connect(uri, { dbName: 'test' })
  return uri
}

/** Tear down the in-memory DB. Call in `afterAll`. */
export async function stopTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  if (mongo) {
    await mongo.stop()
    mongo = null
  }
}

/** Drop all collections between tests so suites stay isolated. */
export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
}
