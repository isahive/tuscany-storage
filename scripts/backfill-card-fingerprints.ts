/**
 * Backfill Tenant.cardFingerprint for every tenant with a default payment
 * method but no fingerprint cached.
 *
 * The duplicate-tenant scanner uses `cardFingerprint` to detect "same physical
 * card" matches without hitting Stripe per tenant. New writes are kept in sync
 * by the Tenant pre-save hook; this script reconciles existing rows.
 *
 * Idempotent — re-running just refreshes the cached value.
 *
 * Usage:  npx tsx scripts/backfill-card-fingerprints.ts
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is required — aborting.')
    process.exit(1)
  }

  console.log('Connecting to MongoDB…')
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  console.log('Connected.')

  const tenants = db.collection('tenants')
  const candidates = await tenants
    .find(
      { defaultPaymentMethodId: { $exists: true, $ne: null } },
      { projection: { defaultPaymentMethodId: 1 } },
    )
    .toArray()
  console.log(`Tenants with a default payment method: ${candidates.length}\n`)

  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let updated = 0
  let cleared = 0
  let failed = 0

  for (const t of candidates) {
    const pmId = t.defaultPaymentMethodId as string
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId)
      const fingerprint = pm.card?.fingerprint
      if (fingerprint) {
        await tenants.updateOne({ _id: t._id }, { $set: { cardFingerprint: fingerprint } })
        updated++
        process.stdout.write(`  ${updated} ✓ ${t._id}\r`)
      } else {
        await tenants.updateOne({ _id: t._id }, { $unset: { cardFingerprint: '' } })
        cleared++
      }
    } catch (err) {
      failed++
      console.error(`  ✗ ${t._id} (${pmId}): ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('\n\nDone.')
  console.log(`  Updated:  ${updated}`)
  console.log(`  Cleared:  ${cleared}`)
  console.log(`  Failed:   ${failed}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
