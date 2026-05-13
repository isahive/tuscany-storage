/**
 * Imports customers from a CSV into the DB without touching units/leases/promos
 * beyond linking tenants to their existing rentals.
 *
 * CSV columns expected (in order):
 *   Customer, Phone, Cell Phone, Email, Balance, Rentals
 *
 * Behavior:
 *   - Upserts tenants by email
 *   - Links existing units (by unitNumber) to tenants and marks status=occupied
 *   - Default password for all tenants: "tenant123" (hashed)
 *
 * Run with:
 *   npm run seed:customers
 *   npm run seed:customers -- "path/to/Customers.csv"   (defaults to D:/Users/silvi/Downloads/Customers.csv)
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import fs from 'fs'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'
const CSV_PATH = process.argv[2] || 'D:/Users/silvi/Downloads/Customers.csv'

// ── Minimal CSV row parser (handles quoted fields) ───────────────────────────
function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim()
  if (!trimmed) return { firstName: '-', lastName: '-' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function parseBalanceCents(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/[$,\s]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars)) return 0
  return Math.round(dollars * 100)
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at: ${CSV_PATH}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) {
    console.error('CSV has no data rows.')
    process.exit(1)
  }

  console.log(`Connecting to MongoDB…`)
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!

  const tenants = db.collection('tenants')
  const units = db.collection('units')

  const defaultPassword = await bcrypt.hash('tenant123', 12)

  let created = 0
  let updated = 0
  let placeholderEmails = 0
  let linked = 0
  const missingUnits: string[] = []
  const placeholderRows: string[] = []

  function placeholderEmail(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'unnamed'
    return `${slug}@tuscanystorage.local`
  }

  console.log(`Parsing ${lines.length - 1} rows from ${CSV_PATH}`)

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const [customer, phone, cellPhone, email, balanceRaw, rentalsRaw] = cols

    let normalizedEmail: string
    if (email && email.includes('@')) {
      normalizedEmail = email.toLowerCase().trim()
    } else {
      normalizedEmail = placeholderEmail(customer || `row-${i}`)
      placeholderEmails++
      placeholderRows.push(`row ${i + 1}: "${customer}" → ${normalizedEmail}`)
    }
    const { firstName, lastName } = splitName(customer)
    const balance = parseBalanceCents(balanceRaw)
    const status = balance > 0 ? 'delinquent' : 'active'
    const cell = (cellPhone || '').trim()
    const land = (phone || '').trim()
    // Primary phone = cell if present, else landline. Alternate = landline.
    const primaryPhone = cell || land
    const altPhone = land && land !== cell ? land : ''

    const existing = await tenants.findOne({ email: normalizedEmail })

    if (existing) {
      await tenants.updateOne(
        { _id: existing._id },
        {
          $set: {
            firstName,
            lastName,
            phone: primaryPhone || existing.phone || '',
            alternatePhone: altPhone || existing.alternatePhone || '',
            balance,
            status,
            updatedAt: new Date(),
          },
        }
      )
      updated++
    } else {
      await tenants.insertOne({
        firstName,
        lastName,
        email: normalizedEmail,
        phone: primaryPhone,
        alternatePhone: altPhone,
        password: defaultPassword,
        role: 'tenant',
        autopayEnabled: false,
        balance,
        status,
        smsOptIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created++
    }

    const tenantDoc = await tenants.findOne({ email: normalizedEmail })
    if (!tenantDoc) continue

    // Link rentals: space-separated unit numbers (may be empty / "")
    const rentalsStr = (rentalsRaw ?? '').trim().replace(/^"|"$/g, '')
    if (!rentalsStr) continue
    const unitNumbers = rentalsStr.split(/\s+/).filter(Boolean)

    for (const unitNumber of unitNumbers) {
      const unit = await units.findOne({ unitNumber })
      if (!unit) {
        missingUnits.push(`${unitNumber} (tenant: ${firstName} ${lastName})`)
        continue
      }
      await units.updateOne(
        { _id: unit._id },
        {
          $set: {
            currentTenantId: tenantDoc._id,
            status: 'occupied',
            updatedAt: new Date(),
          },
        }
      )
      linked++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Tenants created:           ${created}`)
  console.log(`Tenants updated:           ${updated}`)
  console.log(`Placeholder emails used:   ${placeholderEmails}`)
  console.log(`Rentals linked:            ${linked}`)
  if (placeholderRows.length > 0) {
    console.log(`\nRows with placeholder email (${placeholderRows.length}):`)
    placeholderRows.forEach((r) => console.log(`  ${r}`))
  }
  if (missingUnits.length > 0) {
    console.log(`\nMissing units (${missingUnits.length}):`)
    missingUnits.slice(0, 15).forEach((m) => console.log(`  ${m}`))
    if (missingUnits.length > 15) console.log(`  …+${missingUnits.length - 15} more`)
  }
  console.log('\nDefault password for new tenants: tenant123')

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
