/**
 * Creates (or resets the password of) the admin user without touching any other data.
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/create-admin.ts
 * Or with environment overrides:
 *   ADMIN_PASSWORD=mypassword npx ts-node --project tsconfig.scripts.json scripts/create-admin.ts
 */

import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set in .env.local')
  process.exit(1)
}

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@tuscanystorage.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

async function run() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI as string)
  console.log('Connected.')

  const db = mongoose.connection.db!
  const col = db.collection('tenants')

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const result = await col.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      $set: {
        firstName: 'Admin',
        lastName: 'User',
        email: ADMIN_EMAIL,
        phone: '555-000-0000',
        password: hashed,
        role: 'admin',
        autopayEnabled: false,
        status: 'active',
        smsOptIn: false,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, returnDocument: 'after' },
  )

  if (result) {
    console.log(`✅  Admin upserted: ${ADMIN_EMAIL}`)
  } else {
    console.log(`✅  Admin created: ${ADMIN_EMAIL}`)
  }
  console.log(`🔑  Password: ${ADMIN_PASSWORD}`)

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('❌  Failed:', err)
  process.exit(1)
})
