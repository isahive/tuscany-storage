/**
 * One-shot migration: wipes the Atlas database and copies every collection
 * from local Mongo into Atlas. Used to push the demo state to prod.
 *
 * Run:  ATLAS_MONGODB_URI=… npm run migrate:local-to-atlas
 *
 * Requires:
 *   ATLAS_MONGODB_URI   mongodb+srv://…/tuscany-storage  (REQUIRED — no default)
 *   LOCAL_MONGODB_URI   mongodb://localhost:27017/tuscany-storage  (optional)
 *
 * NEVER hardcode the Atlas URI here. Read it from the environment.
 */
import { MongoClient } from 'mongodb'

const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'
if (!process.env.ATLAS_MONGODB_URI) {
  console.error('ATLAS_MONGODB_URI env var is required. Refusing to run without it.')
  process.exit(1)
}
const ATLAS_URI: string = process.env.ATLAS_MONGODB_URI

function mask(uri: string): string {
  return uri.replace(/\/\/[^@]+@/, '//***@')
}

async function main() {
  console.log(`Local : ${mask(LOCAL_URI)}`)
  console.log(`Atlas : ${mask(ATLAS_URI)}\n`)

  const localClient = new MongoClient(LOCAL_URI)
  const atlasClient = new MongoClient(ATLAS_URI)
  await Promise.all([localClient.connect(), atlasClient.connect()])

  const localDb = localClient.db()
  const atlasDb = atlasClient.db()

  const localCols = (await localDb.listCollections().toArray()).map((c) => c.name).sort()
  const atlasColsBefore = (await atlasDb.listCollections().toArray()).map((c) => c.name).sort()

  console.log(`Local collections: ${localCols.length}`)
  console.log(`Atlas collections before: ${atlasColsBefore.length}\n`)

  // Drop every existing collection in Atlas so we start clean.
  for (const name of atlasColsBefore) {
    await atlasDb.collection(name).drop().catch(() => {})
    console.log(`  dropped Atlas.${name}`)
  }
  console.log('')

  // Copy each local collection in batches.
  const BATCH = 500
  let totalCopied = 0
  for (const name of localCols) {
    const src = localDb.collection(name)
    const dst = atlasDb.collection(name)
    const count = await src.countDocuments({})
    if (count === 0) {
      console.log(`  ${name.padEnd(35)} 0 docs — skipped`)
      continue
    }
    const cursor = src.find({}, { batchSize: BATCH })
    let buf: any[] = []
    let copied = 0
    while (await cursor.hasNext()) {
      buf.push(await cursor.next())
      if (buf.length >= BATCH) {
        await dst.insertMany(buf, { ordered: false })
        copied += buf.length
        buf = []
      }
    }
    if (buf.length > 0) {
      await dst.insertMany(buf, { ordered: false })
      copied += buf.length
    }
    totalCopied += copied
    console.log(`  ${name.padEnd(35)} ${copied.toLocaleString()} docs`)
  }

  // Re-create indexes (other than the default _id) to mirror local.
  console.log('\nRebuilding indexes…')
  for (const name of localCols) {
    const indexes = await localDb.collection(name).indexes()
    const nonDefault = indexes.filter((i) => i.name !== '_id_')
    for (const idx of nonDefault) {
      try {
        await atlasDb.collection(name).createIndex(idx.key, {
          name: idx.name,
          unique: idx.unique,
          sparse: idx.sparse,
          // Drop fields createIndex doesn't accept on the options.
          ...(idx.expireAfterSeconds !== undefined && { expireAfterSeconds: idx.expireAfterSeconds }),
        })
      } catch (e: any) {
        // Indexes may already exist if a write triggered Mongoose's auto-build.
        if (!String(e?.message ?? '').includes('IndexOptionsConflict') &&
            !String(e?.message ?? '').includes('already exists')) {
          console.warn(`    ${name}.${idx.name}: ${e.message}`)
        }
      }
    }
  }

  console.log(`\nDone. Copied ${totalCopied.toLocaleString()} documents across ${localCols.length} collections.`)
  await Promise.all([localClient.close(), atlasClient.close()])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
