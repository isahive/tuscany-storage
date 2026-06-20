/**
 * Add a waiting-list signup from Storable to a tenant (matched by email).
 * Creates a WaitingList doc + flips tenant.onWaitingList; the admin profile
 * banner reads it back by email.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-waitlist.ts <email> "<size>" ["<type>"] ["<memo>"] [--apply]
 * Example:
 *   ... add-waitlist.ts crystalyork93@yahoo.com "10 x 20" --apply
 */
import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
const APPLY = process.argv.includes('--apply')
const [email, size, type, memo] = process.argv.slice(2).filter((a) => a !== '--apply')
if (!email || !size) { console.error('Usage: add-waitlist.ts <email> "<size>" ["<type>"] ["<memo>"] [--apply]'); process.exit(1) }

async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const now = new Date()
  const t = await db.collection('tenants').findOne({ email: new RegExp(`^${email}$`, 'i') })
  if (!t) { console.error(`Tenant ${email} not found`); process.exit(1) }
  const existing = await db.collection('waitinglists').findOne({ email: email.toLowerCase() })

  console.log(`Tenant: ${t.firstName} ${t.lastName} <${t.email}> phone=${t.phone || '-'}`)
  console.log(`Waitlist: size="${size}" type="${type ?? '(none)'}" memo="${memo ?? '(none)'}" | existing=${existing ? existing._id : 'none'}`)
  if (!APPLY) { console.log('\nDry run — re-run with --apply.'); await mongoose.disconnect(); return }

  if (existing) {
    await db.collection('waitinglists').updateOne(
      { _id: existing._id },
      { $set: { preferredSize: size, ...(type ? { preferredType: type } : {}), ...(memo ? { notes: memo } : {}), status: 'waiting', updatedAt: now } },
    )
    console.log('Updated existing waitinglist entry.')
  } else {
    await db.collection('waitinglists').insertOne({
      name: `${t.firstName} ${t.lastName}`.trim(),
      email: email.toLowerCase(),
      phone: t.phone || 'N/A',
      preferredSize: size,
      ...(type ? { preferredType: type } : {}),
      ...(memo ? { notes: memo } : {}),
      smsOptIn: false,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
    })
    console.log('Inserted waitinglist entry.')
  }
  await db.collection('tenants').updateOne(
    { _id: t._id },
    { $set: { onWaitingList: true, updatedAt: now, ...(memo ? { notes: memo } : {}) } },
  )
  console.log('tenant.onWaitingList = true' + (memo ? ' + memo set' : ''))
  await mongoose.disconnect()
  console.log('Done.')
}
main().catch((e) => { console.error(e); process.exit(1) })
