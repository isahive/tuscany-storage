/**
 * Imports the "Credit Without Payment" report from Storable Easy.
 * The PDF lists ~146 manual credits (deposit refunds, transfers, fee
 * forgiveness, auction proceeds) totaling $11,474.88 between 2022-2026.
 *
 * Each credit is inserted as a Payment doc with:
 *   type:   'credit'
 *   status: 'succeeded'
 *   amount: positive cents (a credit reduces what the tenant owes when the
 *           generate-rent-charges script applies it against pending invoices)
 *
 * Idempotent via deterministic stripePaymentIntentId.
 *
 * Run:  npm run import:credits
 */
import mongoose from 'mongoose'
import crypto from 'crypto'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'
const IMPORT_SOURCE = 'pdf-credits-2026-05-14'

// Rows transcribed from "Credit Without Payment.pdf".
// Format: { date: 'YYYY-MM-DD HH:MM', name, notes, amount(cents) }
const CREDITS: Array<{ date: string; name: string; notes: string; amount: number }> = [
  { date: '2026-04-30 06:24', name: 'Pam Campbell', notes: 'To cover fee', amount: 3000 },
  { date: '2026-04-05 19:11', name: 'Karen Duckworth', notes: 'Transferred from G2 to A16', amount: 16700 },
  { date: '2026-03-31 18:03', name: 'Ashley', notes: 'Moved out - refunded deposit and prepaid April rent and tenant protection', amount: 26000 },
  { date: '2026-02-21 20:16', name: 'Debra Lane', notes: 'Transferred from 1 to 11', amount: 26000 },
  { date: '2025-10-14 19:49', name: 'Gregory Porter', notes: 'A9 deposit refund', amount: 6000 },
  { date: '2025-09-10 18:51', name: 'Kimberly phillips', notes: 'Deposit from G13 when moved out', amount: 14500 },
  { date: '2025-06-03 14:45', name: 'Jessica C Eipp', notes: 'Credit for B12 transfer to B7', amount: 9400 },
  { date: '2025-06-03 14:43', name: 'Jessica C Eipp', notes: 'Transferred from B13 to B7', amount: 9400 },
  { date: '2025-06-02 07:50', name: 'Esker Braden', notes: 'Credit from reservation of Unit D4.', amount: 12000 },
  { date: '2025-04-26 10:43', name: 'Vietta Roberts', notes: 'Deposit from open air and 1/2 of first months rents already paid', amount: 11005 },
  { date: '2025-04-23 13:15', name: 'Vietta Roberts', notes: 'Credit for deposit previously paid.', amount: 7500 },
  { date: '2025-04-10 22:56', name: 'Randy Treber', notes: 'Credit for deposit previously paid.', amount: 7000 },
  { date: '2025-02-22 18:02', name: 'Kimberly phillips', notes: 'Transferred from D23 to 4', amount: 6000 },
  { date: '2025-02-22 18:02', name: 'Kimberly phillips', notes: 'Credit for deposit previously paid.', amount: 14500 },
  { date: '2024-12-05 14:24', name: 'Vietta Roberts', notes: 'Zero account', amount: 11500 },
  { date: '2024-11-27 14:06', name: 'Kimberly phillips', notes: 'Transferred from A7 to G13', amount: 18274 },
  { date: '2024-11-25 12:57', name: 'Lucilla L Daniel', notes: 'Deposit for G13', amount: 6000 },
  { date: '2024-11-02 11:01', name: 'Randy Treber', notes: 'Credit for deposit previously paid.', amount: 8000 },
  { date: '2024-10-29 16:20', name: 'Ryan T Lamons', notes: 'Deposit refunded for D10 after move out', amount: 6000 },
  { date: '2024-09-05 18:56', name: 'Alan Wolfe', notes: 'Cut Lock fee refund', amount: 2000 },
  { date: '2024-08-24 19:42', name: 'Brenda Christoper', notes: 'Credit from reservation of Unit D11.', amount: 6500 },
  { date: '2024-08-06 11:46', name: 'Sue M Petrack', notes: 'Deposit from P4 upon move out', amount: 9500 },
  { date: '2024-08-04 19:42', name: 'David Wayne Eddy', notes: 'Deposit refund after move out', amount: 7500 },
  { date: '2024-07-13 16:55', name: 'David Wayne Eddy', notes: 'Credit for deposit previously paid.', amount: 7500 },
  { date: '2024-07-10 16:32', name: 'Stephen Wax', notes: 'Credit for deposit previously paid.', amount: 7500 },
  { date: '2024-07-10 16:27', name: 'Ken Wolf', notes: 'Transferred from P24 to P25', amount: 11250 },
  { date: '2024-06-19 18:04', name: 'Evelyn M Holcomb', notes: 'To zero out deposit refund after move out', amount: 7500 },
  { date: '2024-06-13 14:00', name: 'Amber Bates', notes: 'Moved out without paying or clearing unit. Zeroing account to archive. Total loss.', amount: 32500 },
  { date: '2024-06-05 19:59', name: 'Amber D young', notes: 'Moved out. Refunded deposit. Zero balance to archive', amount: 23200 },
  { date: '2024-06-03 13:38', name: 'Evelyn M Holcomb', notes: 'Credit from renting on other account. Consolidate into one profile', amount: 11500 },
  { date: '2024-04-26 14:01', name: 'Erin M Cleland', notes: 'Previous price match', amount: 3000 },
  { date: '2024-04-14 12:34', name: 'Pat Voyles', notes: 'Moved out-deposit to archive', amount: 12500 },
  { date: '2024-04-08 13:02', name: 'Fortis Industries', notes: 'Zero balance to archive after move out', amount: 19500 },
  { date: '2024-04-08 12:43', name: 'Sarah L Lowe', notes: 'Deposits from Christopher Wilson units A14 and B23', amount: 12000 },
  { date: '2024-04-06 16:05', name: 'Erin M Cleland', notes: 'Matching previous rental price', amount: 3000 },
  { date: '2024-04-04 17:10', name: 'Caleb Taylor Spears', notes: 'Zero balance after losses upon move out- archive', amount: 12000 },
  { date: '2024-04-04 17:06', name: 'Caleb Taylor Spears', notes: 'Deposit upon move out', amount: 9500 },
  { date: '2024-03-14 12:50', name: 'Michael Click', notes: 'Deposit refund after move out', amount: 6000 },
  { date: '2024-03-12 11:02', name: 'Patricia A Barber', notes: 'Archiving account - documented as loss', amount: 2000 },
  { date: '2024-03-12 09:45', name: 'Patricia A Barber', notes: 'Deposit applied', amount: 7500 },
  { date: '2024-03-11 12:59', name: 'Devin Petrack', notes: 'Deposit refunded upon move out', amount: 10000 },
  { date: '2024-02-28 10:40', name: 'Brody j hornsby', notes: 'Moved out - archive', amount: 8000 },
  { date: '2024-02-28 10:36', name: 'Brody j hornsby', notes: 'Deposit sent back to account for moving out without notice and left garbage', amount: 6000 },
  { date: '2024-02-11 14:08', name: 'Franklin D Mcfall', notes: 'Moved out', amount: 14000 },
  { date: '2024-02-11 14:07', name: 'Michael Click', notes: 'Moved out', amount: 12000 },
  { date: '2024-02-11 14:06', name: 'Jennifer Lucas', notes: 'Moved out', amount: 12000 },
  { date: '2024-02-11 14:06', name: 'Reba D Snyder', notes: 'Moved out', amount: 12000 },
  { date: '2024-02-11 14:05', name: 'Steven d Richmond', notes: 'Moved out', amount: 9500 },
  { date: '2024-02-11 14:04', name: 'Crystal Wright', notes: 'Moved out', amount: 7000 },
  { date: '2024-02-11 14:03', name: 'Justin Roberts', notes: 'Auctioned', amount: 33500 },
  { date: '2024-02-11 14:02', name: 'Xavier Kelly', notes: 'Moved out', amount: 6919 },
  { date: '2024-02-11 13:58', name: 'Gary Goodman', notes: 'Auctioned on 2/11 for $50. Documented as loss for 2024', amount: 42000 },
  { date: '2024-02-11 13:54', name: 'Gary Goodman', notes: 'Auction - contribution from buyer', amount: 5000 },
  { date: '2024-02-11 13:50', name: 'Michael A Odell', notes: 'Auction - contribution from buyer', amount: 5000 },
  { date: '2024-01-24 12:53', name: 'Andrew S Payne', notes: 'Deposit refund for G2-moved out', amount: 12000 },
  { date: '2024-01-08 18:58', name: 'Katrina D. Harvey', notes: 'Credits from Vincent D11 Jan prorated and deposit', amount: 11200 },
  { date: '2024-01-06 13:16', name: 'Richard L. Beheler Sr.', notes: 'Moved out 12/18', amount: 14000 },
  { date: '2024-01-02 21:20', name: 'Pam Campbell', notes: 'Did not move in - refunded all of initial deposit and charges', amount: 19500 },
  { date: '2023-12-30 12:54', name: 'Matthew W Seprish', notes: 'Moved out - deposit refunded', amount: 11000 },
  { date: '2023-12-05 16:49', name: 'Tory Dean Wilson', notes: 'Deposit re-credited, applying $70 to Dec and refunding $20 upon move out.', amount: 9000 },
  { date: '2023-11-18 17:38', name: 'Bonnie Olsten', notes: '', amount: 6000 },
  { date: '2023-11-09 16:49', name: 'Christopher A Fontana', notes: 'Losses - zeroing to close/archive account', amount: 15300 },
  { date: '2023-11-08 13:27', name: 'Christopher A Fontana', notes: 'Deposit applied to outstanding balance', amount: 9000 },
  { date: '2023-10-13 19:37', name: 'Heather L Hornsby', notes: 'Balance and close after move out.', amount: 2000 },
  { date: '2023-10-13 19:33', name: 'Heather L Hornsby', notes: 'Deposit applied to balance at move out which was on 10/7 but reported on 10/13', amount: 12000 },
  { date: '2023-10-11 14:11', name: 'Tracy Bastien', notes: 'P21 deposit and prorated rent from 10/13 on refunded upon move out', amount: 12339 },
  { date: '2023-10-06 20:17', name: 'Brent O Leach', notes: 'Moved out refund deposit', amount: 9500 },
  { date: '2023-09-10 12:32', name: 'Gary & Heather Ann Everly', notes: 'Deposit from Gary when moved out of his 5x10', amount: 2000 },
  { date: '2023-09-05 14:38', name: 'Sue M Petrack', notes: 'From other account', amount: 19500 },
  { date: '2023-08-28 18:18', name: 'Brent O Leach', notes: 'Deposit refunded on move out', amount: 15000 },
  { date: '2023-08-27 10:36', name: 'Vietta Roberts', notes: 'Moved out-deposit refunded', amount: 9500 },
  { date: '2023-08-27 10:28', name: 'Tanja J Wilson', notes: 'Moved out-deposit refunded', amount: 7500 },
  { date: '2023-08-15 15:19', name: 'Vietta Roberts', notes: 'Credit for deposit previously paid.', amount: 9500 },
  { date: '2023-08-10 14:59', name: 'Diana Kuper', notes: 'Moved out of D3 on first day of billing cycle - finalized 8/8', amount: 4000 },
  { date: '2023-07-31 20:22', name: 'Vietta Roberts', notes: 'Deposit Refund for P18', amount: 9500 },
  { date: '2023-07-31 16:11', name: 'Kathryn C. Adams', notes: 'B24 Deposit refunded on Move out', amount: 8500 },
  { date: '2023-07-27 21:18', name: 'Vietta Roberts', notes: 'Credit for deposit previously paid.', amount: 9500 },
  { date: '2023-07-23 17:49', name: 'Daniel J Birchfield', notes: 'Deposit refunded - moved out', amount: 9500 },
  { date: '2023-07-09 16:26', name: 'Kyler A Gaston', notes: 'Moved out - deposit refund', amount: 12000 },
  { date: '2023-07-08 08:16', name: 'Kevin Franklin', notes: 'Transferred from P13 to P7', amount: 7500 },
  { date: '2023-06-25 08:32', name: 'Daniel J Birchfield', notes: 'Credit for deposit previously paid.', amount: 9500 },
  { date: '2023-06-23 20:38', name: 'Evelyn M Holcomb', notes: 'Credit for deposit previously paid.', amount: 10000 },
  { date: '2023-06-23 20:22', name: 'Steven d Richmond', notes: 'Credit for deposit previously paid.', amount: 10000 },
  { date: '2023-06-23 19:45', name: 'Daniel J Birchfield', notes: 'Transferred from P12 to P3', amount: 16250 },
  { date: '2023-06-23 13:17', name: 'Stephen Wax', notes: 'Inconvenience of moving camper multiple times', amount: 5000 },
  { date: '2023-06-20 12:39', name: 'Devin Petrack', notes: 'Deposit refund', amount: 9500 },
  { date: '2023-06-19 09:46', name: 'Breanna N McDonald', notes: 'Deposit refund', amount: 7500 },
  { date: '2023-05-30 09:00', name: 'Richard Varhola', notes: 'Zero out refunded deposit', amount: 5500 },
  { date: '2023-05-26 13:26', name: 'Evelyn M Holcomb', notes: 'New storage unit bonus offer', amount: 7500 },
  { date: '2023-05-24 14:25', name: 'Brent O Leach', notes: 'New Unit rental promotion bonus', amount: 7000 },
  { date: '2023-02-11 09:23', name: 'Charmin Brooks', notes: 'Transferred from B24 to D20', amount: 12625 },
  { date: '2023-01-31 12:18', name: 'Kyle Franz', notes: 'Transferred from B24 to A23', amount: 3726 },
  { date: '2023-01-31 10:09', name: 'Kyle Franz', notes: 'Transferred from A23 to B25', amount: 3500 },
  { date: '2022-09-02 12:39', name: 'Richard Gaynor', notes: '', amount: 10000 },
  { date: '2022-08-16 12:32', name: 'Gary Woodward', notes: 'Credit from reservation of Unit C14.', amount: 5000 },
  { date: '2022-08-12 13:26', name: 'Brittany Stanifer', notes: 'One time late fee forgiveness', amount: 2000 },
  { date: '2022-07-19 12:43', name: 'Shalon Whitfield', notes: 'pro-rated A27 moved out 7/19/22', amount: 1900 },
  { date: '2022-07-19 12:42', name: 'Shalon Whitfield', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-07-08 13:24', name: 'Savannah Eagleton', notes: 'Transferred from B22 to C1', amount: 10000 },
  { date: '2022-07-06 11:23', name: 'Beatrice K Chinn', notes: 'Credit for deposit previously paid.', amount: 7500 },
  { date: '2022-07-05 13:03', name: 'Allison Baird', notes: 'Late fee invoiced early', amount: 2000 },
  { date: '2022-07-05 09:34', name: 'David Southern', notes: 'Late fee invoiced too early and paid', amount: 2000 },
  { date: '2022-07-05 09:33', name: 'Jeff Trump', notes: '', amount: 2000 },
  { date: '2022-06-29 19:21', name: 'Diana Kuper', notes: 'Credit from reservation of Unit D3.', amount: 8500 },
  { date: '2022-06-13 13:58', name: 'Helen Watson', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-13 13:57', name: 'Kyle Franz', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-13 13:26', name: 'Shalon Whitfield', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-08 16:51', name: 'Brian Strong', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:54', name: 'Elijah Holt', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:52', name: 'Gary Everly Jr', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:47', name: 'Jonathan Gundler', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-07 19:35', name: 'Justin Roberts', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:32', name: 'Tabitha Underwood', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:29', name: 'Gary Everly Jr', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:19', name: 'Brian Sheldon', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 19:17', name: 'Charles Sharp', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 17:53', name: 'Gregory Porter', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-07 17:51', name: 'Lori Noonan', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 17:39', name: 'Kim Knowerchild', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 17:33', name: 'Elizabeth Long', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 17:30', name: 'Craig Maes', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 17:17', name: 'George Mullins', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-07 16:35', name: 'Patrick Morris', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 15:17', name: 'Jennifer Holland', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 15:02', name: 'Nella Shrader', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 15:00', name: 'Polly Aslinger', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 14:16', name: 'Brian Strong', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 13:43', name: 'David Southern', notes: 'Credit for deposit previously paid.', amount: 5000 },
  { date: '2022-06-07 09:10', name: 'Karen Spivey', notes: 'Deposit was paid previously', amount: 2000 },
  { date: '2022-06-07 09:05', name: 'The Orphans Hands', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-07 08:19', name: 'Sandra Spencer', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 07:54', name: 'Brenda Christoper', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-07 07:35', name: 'Bryon Blaylock', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-06 16:49', name: 'Beatrice K Chinn', notes: 'Credit for deposit previously paid.', amount: 7500 },
  { date: '2022-06-06 15:21', name: 'Clifford Bean', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-06 15:21', name: 'Allison Baird', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-06 15:11', name: 'Sandra Vogt', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-06 14:34', name: 'Robert Blackman', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-06 11:54', name: 'Joshua Chambers', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-06 11:41', name: 'Pamela A Burden', notes: 'Credit for deposit previously paid.', amount: 10000 },
  { date: '2022-06-06 10:56', name: 'Patricia (Tish) Noe', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-06 10:47', name: 'Reba Smith', notes: 'Credit for deposit previously paid.', amount: 2000 },
  { date: '2022-06-06 10:40', name: 'Melissa Hicks', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-01 19:40', name: 'Joe Chamblee', notes: 'Credit for deposit previously paid.', amount: 2500 },
  { date: '2022-06-01 19:36', name: 'Charlie Smith', notes: 'Credit for deposit previously paid.', amount: 2000 },
]

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .split(' ')
    .filter((p) => !/^[a-z]\.?$/.test(p))
    .join(' ')
}

async function run() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const tenants = db.collection('tenants')
  const payments = db.collection('payments')
  const leases = db.collection('leases')

  // Build name → tenant lookup.
  const all = await tenants.find({}, { projection: { firstName: 1, lastName: 1 } }).toArray()
  const byName = new Map<string, any>()
  for (const t of all) {
    byName.set(normalizeName(`${t.firstName} ${t.lastName}`), t)
  }
  console.log(`Loaded ${all.length} tenants.`)

  let inserted = 0
  let skippedExisting = 0
  let skippedNoTenant = 0
  const unmatched: string[] = []

  for (const c of CREDITS) {
    const key = normalizeName(c.name)
    const tenant = byName.get(key)
    if (!tenant) {
      skippedNoTenant++
      unmatched.push(c.name)
      continue
    }

    const rowHash = crypto
      .createHash('sha1')
      .update(`${c.date}|${c.name}|${c.notes}|${c.amount}`)
      .digest('hex')
    const importId = `credit_${rowHash}`

    const existing = await payments.findOne({ stripePaymentIntentId: importId })
    if (existing) { skippedExisting++; continue }

    const lease = await leases.findOne(
      { tenantId: tenant._id, status: { $in: ['active', 'pending_moveout'] } },
      { sort: { createdAt: -1 } },
    )

    const date = new Date(c.date.replace(' ', 'T') + ':00')

    await payments.insertOne({
      tenantId: tenant._id,
      leaseId: lease?._id,
      unitId: lease?.unitId,
      stripePaymentIntentId: importId,
      amount: c.amount,
      currency: 'usd',
      type: 'credit',
      status: 'succeeded',
      periodStart: date,
      periodEnd: date,
      attemptCount: 1,
      lastAttemptAt: date,
      description: c.notes || 'Manual credit',
      importSource: IMPORT_SOURCE,
      createdAt: date,
      updatedAt: date,
    })
    inserted++
  }

  console.log('\n=== Summary ===')
  console.log(`Inserted credit Payment docs:  ${inserted}`)
  console.log(`Skipped (already imported):    ${skippedExisting}`)
  console.log(`Skipped (no tenant match):     ${skippedNoTenant}`)
  if (unmatched.length > 0) {
    console.log('\nUnmatched names:')
    const uniq = [...new Set(unmatched)]
    for (const n of uniq) console.log(`  ${n}`)
  }
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
