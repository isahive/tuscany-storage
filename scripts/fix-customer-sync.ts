/**
 * One-off sync fix (June 2026): the May 13 import predates several real-world
 * move-ins/move-outs, so the DB drifted from the facility's current customer
 * list ("Customers (1).csv").
 *
 * What it does:
 *   1. Creates the customers present in the CSV but missing from the DB,
 *      copying emails/phones VERBATIM from the CSV (even the
 *      marlowapril09@hmail.com typo) — the /admin/tenants/duplicates panel is
 *      where the operator resolves the April Marlow / Michael Higginbotham
 *      email crossing.
 *   2. Ends leases for tenants who no longer appear in the CSV (moved out
 *      since the import) and for the @example.com seed tenants, mirroring the
 *      admin move-out flow (lease ended + unit freed + tenant moved_out).
 *      Crocco only loses D9 (he keeps unit 5), so his tenant status is kept.
 *   3. Assigns units to their rightful tenants per the CSV and creates active
 *      leases (startDate = today, billingDay 1, rate = unit.price) so the
 *      portal dashboard and rent-charge cron both see them.
 *
 * Deliberately untouched: existing tenants' balances/statuses, Deidra
 * Bailey's H5 (possibly rented after the CSV export), Silvio's test G5.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/fix-customer-sync.ts          (dry run)
 *   npx tsx --env-file=.env.local scripts/fix-customer-sync.ts --apply
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }
const APPLY = process.argv.includes('--apply')

// ── Customers in the CSV but missing from the DB (from crossmatch audit) ────
const NEW_TENANTS = [
  { firstName: 'April', lastName: 'marlow', email: 'marlowapril09@hmail.com', phone: '(423) 437-2872', unit: 'B14' },
  { firstName: 'Brian', lastName: 'Case', email: 'bacase404@gmail.com', phone: '(865) 206-1402', unit: null },
  { firstName: 'Carlos', lastName: 'Johnson', email: 'cjohnson247iw.cj@gmail.com', phone: '(865) 333-9612', unit: 'D9' },
  { firstName: 'Crystal', lastName: 'Annette York', email: 'crystalyork93@yahoo.com', phone: '(423) 592-0520', unit: null },
  { firstName: 'Patrick', lastName: 'dardis', email: 'pjdardis@gmail.com', phone: '(937) 477-8516', unit: null },
  { firstName: 'Rachel', lastName: 'Kennedy', email: 'rjweltch@gmail.com', phone: '(865) 405-2811', unit: 'G3' },
  { firstName: 'Tosha', lastName: 'L Colquitt', email: 'tlamcghee@gmail.com', phone: '(865) 936-0221', unit: 'D1' },
]

// ── Tenants holding units but absent from the CSV → move out ────────────────
// email → { archive: also hide from admin lists/duplicates (seed/test data) }
const MOVE_OUT = new Map<string, { archive: boolean }>([
  ['kori.atkins1994@yahoo.com', { archive: false }], // Corey Atkins — B14 (April's)
  ['ladinred1000@yahoo.com', { archive: false }],    // Kim A Jones — D1 (Tosha's)
  ['karaandbryce7709@gmail.com', { archive: false }],// Bryce Hickey — C18 (stays vacant)
  ['bob@example.com', { archive: true }],            // seed data — A24
  ['john@example.com', { archive: true }],           // seed data — lease on Tina Hurst's A14
  ['jane@example.com', { archive: true }],           // seed data — lease on Ruby Duff's A23
])

// ── Lease-only removals: tenant stays, just loses the unit ──────────────────
const END_LEASE_ONLY = [
  { email: 'mcrocco2018@gmail.com', unit: 'D9' }, // Michael Crocco — CSV says he only has unit 5
]

// ── Units that must end up assigned (tenant email → unit) ───────────────────
const ASSIGN = [
  { email: 'marlowapril09@hmail.com', unit: 'B14' },
  { email: 'cjohnson247iw.cj@gmail.com', unit: 'D9' },
  { email: 'rjweltch@gmail.com', unit: 'G3' },
  { email: 'tlamcghee@gmail.com', unit: 'D1' },
  { email: 'martina.hurst000@icloud.com', unit: 'A14' }, // Tina Hurst — had no lease (seed lease was John Smith's)
  { email: 'rubyduff2018@gmail.com', unit: 'A23' },      // Ruby West Duff — same, lease was Jane Doe's
]

const act = (msg: string) => console.log(`${APPLY ? '✔' : '[dry-run]'} ${msg}`)

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const tenants = db.collection('tenants')
  const units = db.collection('units')
  const leases = db.collection('leases')
  const now = new Date()

  // ── 1. Create missing tenants ──────────────────────────────────────────────
  const defaultPassword = await bcrypt.hash('tenant123', 12)
  for (const t of NEW_TENANTS) {
    const email = t.email.toLowerCase()
    const existing = await tenants.findOne({ email })
    if (existing) { console.log(`  skip create: ${email} already exists`); continue }
    act(`create tenant ${t.firstName} ${t.lastName} <${email}>`)
    if (APPLY) {
      await tenants.insertOne({
        firstName: t.firstName,
        lastName: t.lastName,
        email,
        phone: t.phone,
        alternatePhone: '',
        password: defaultPassword,
        role: 'tenant',
        autopayEnabled: false,
        balance: 0,
        status: 'active',
        smsOptIn: false,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // ── 2. Move-outs for tenants no longer in the CSV ─────────────────────────
  for (const [email, opts] of MOVE_OUT) {
    const tenant = await tenants.findOne({ email })
    if (!tenant) { console.log(`  skip move-out: ${email} not found`); continue }
    const active = await leases.find({ tenantId: tenant._id, status: { $in: ['active', 'pending_moveout'] } }).toArray()
    for (const lease of active) {
      const unit = await units.findOne({ _id: lease.unitId })
      act(`end lease ${lease._id} (${tenant.firstName} ${tenant.lastName} → unit ${unit?.unitNumber ?? lease.unitId})`)
      if (APPLY) {
        await leases.updateOne({ _id: lease._id }, { $set: { status: 'ended', endDate: now, moveOutDate: now, updatedAt: now } })
        await units.updateOne(
          { _id: lease.unitId, currentLeaseId: lease._id },
          { $set: { status: 'available', updatedAt: now }, $unset: { currentTenantId: 1, currentLeaseId: 1 } },
        )
      }
    }
    // Units linked by currentTenantId without that lease (defensive)
    if (APPLY) {
      await units.updateMany(
        { currentTenantId: tenant._id },
        { $set: { status: 'available', updatedAt: now }, $unset: { currentTenantId: 1, currentLeaseId: 1 } },
      )
    }
    act(`set ${tenant.firstName} ${tenant.lastName} status=moved_out${opts.archive ? ' + archived' : ''}`)
    if (APPLY) {
      await tenants.updateOne(
        { _id: tenant._id },
        { $set: { status: 'moved_out', gateCode: null, updatedAt: now, ...(opts.archive ? { archived: true } : {}) } },
      )
    }
  }

  // ── 2b. Lease-only removals (tenant keeps their other units) ──────────────
  for (const item of END_LEASE_ONLY) {
    const tenant = await tenants.findOne({ email: item.email })
    const unit = await units.findOne({ unitNumber: item.unit })
    if (!tenant || !unit) { console.log(`  skip lease-only: ${item.email}/${item.unit} not found`); continue }
    const lease = await leases.findOne({ tenantId: tenant._id, unitId: unit._id, status: { $in: ['active', 'pending_moveout'] } })
    if (!lease) { console.log(`  skip lease-only: no active lease ${item.email} on ${item.unit}`); continue }
    act(`end lease ${lease._id} (${tenant.firstName} ${tenant.lastName} keeps other units, loses ${item.unit})`)
    if (APPLY) {
      await leases.updateOne({ _id: lease._id }, { $set: { status: 'ended', endDate: now, moveOutDate: now, updatedAt: now } })
      await units.updateOne(
        { _id: unit._id },
        { $set: { status: 'available', updatedAt: now }, $unset: { currentTenantId: 1, currentLeaseId: 1 } },
      )
    }
  }

  // ── 3. Assign units + create leases ───────────────────────────────────────
  for (const a of ASSIGN) {
    const tenant = await tenants.findOne({ email: a.email })
    const unit = await units.findOne({ unitNumber: a.unit })
    if (!tenant) { console.log(`  skip assign: tenant ${a.email} not found (dry-run: would be created in step 1)`); continue }
    if (!unit) { console.log(`  skip assign: unit ${a.unit} not found`); continue }

    const blocking = await leases.findOne({
      unitId: unit._id,
      status: { $in: ['active', 'pending_moveout'] },
      tenantId: { $ne: tenant._id },
    })
    if (blocking) {
      console.log(`  ⚠ NOT assigning ${a.unit} to ${a.email}: unit still has active lease ${blocking._id} for tenant ${blocking.tenantId}`)
      continue
    }

    let lease = await leases.findOne({ tenantId: tenant._id, unitId: unit._id, status: { $in: ['active', 'pending_moveout'] } })
    if (!lease) {
      act(`create active lease for ${tenant.firstName} ${tenant.lastName} on ${a.unit} ($${((unit.price ?? 0) / 100).toFixed(2)}/mo, billingDay 1)`)
      if (APPLY) {
        const res = await leases.insertOne({
          tenantId: tenant._id,
          unitId: unit._id,
          startDate: now,
          monthlyRate: unit.price ?? 0,
          deposit: unit.defaultDeposit ?? unit.price ?? 0,
          proratedFirstMonth: 0,
          billingDay: 1,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        lease = { _id: res.insertedId } as any
      }
    } else {
      console.log(`  reuse existing lease ${lease._id} for ${a.email} on ${a.unit}`)
    }
    act(`link unit ${a.unit} → ${tenant.firstName} ${tenant.lastName} (occupied)`)
    if (APPLY && lease) {
      await units.updateOne(
        { _id: unit._id },
        { $set: { currentTenantId: tenant._id, currentLeaseId: lease._id, status: 'occupied', updatedAt: now } },
      )
    }
  }

  console.log(`\n${APPLY ? 'Applied.' : 'Dry run only — re-run with --apply to write.'}`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
