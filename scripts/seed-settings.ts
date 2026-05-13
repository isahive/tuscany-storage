/**
 * Idempotent settings bootstrap.
 *
 * - If no Settings doc exists: inserts one with DEFAULT_SETTINGS.
 * - If one exists: leaves admin-saved values alone, only **fills in missing keys**
 *   from DEFAULT_SETTINGS. Useful when we ship a new release that adds a new
 *   setting and we want it to land for existing tenants without overwriting their
 *   prior customizations.
 *
 * Run with: npm run seed:settings
 */
import mongoose from 'mongoose'
import { DEFAULT_SETTINGS } from '../lib/defaultSettings'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function run() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const settings = db.collection('settings')

  const existing = await settings.findOne({})
  if (!existing) {
    await settings.insertOne({
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    console.log('Settings document created from DEFAULT_SETTINGS.')
  } else {
    // Backfill any keys missing from the existing doc.
    const $setOnMissing: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in existing)) {
        $setOnMissing[key] = value
      }
    }

    if (Object.keys($setOnMissing).length === 0) {
      console.log('Settings already complete. Nothing to backfill.')
    } else {
      await settings.updateOne(
        { _id: existing._id },
        { $set: { ...$setOnMissing, updatedAt: new Date() } }
      )
      console.log(`Backfilled ${Object.keys($setOnMissing).length} missing keys:`)
      Object.keys($setOnMissing).forEach((k) => console.log(`  - ${k}`))
    }
  }

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
