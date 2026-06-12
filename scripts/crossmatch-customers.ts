/**
 * One-off audit: crossmatch the storEDGE "Customers (1).csv" export against
 * Atlas — verify every customer exists and holds the units the CSV says.
 *
 * Usage: npx tsx --env-file=.env.local scripts/crossmatch-customers.ts "D:\\path\\Customers (1).csv"
 */
import mongoose from 'mongoose'
import fs from 'fs'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const csvPath = process.argv[2]
if (!csvPath || !fs.existsSync(csvPath)) { console.error('CSV not found:', csvPath); process.exit(1) }

// Minimal CSV parser handling quoted fields with commas/escaped quotes
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row) }
  return rows
}

function norm(s: string) { return s.trim().toLowerCase() }
function normName(s: string) { return s.trim().toLowerCase().replace(/\s+/g, ' ') }

async function main() {
  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '')
  const [header, ...rows] = parseCsv(raw)
  const col = (name: string) => header.findIndex((h) => norm(h) === norm(name))
  const iName = col('Customer'), iEmail = col('Email'), iPhone = col('Cell Phone'), iRentals = col('Rentals')

  type CsvCust = { line: number; name: string; email: string; phone: string; units: string[] }
  const customers: CsvCust[] = rows.map((r, idx) => ({
    line: idx + 2,
    name: r[iName]?.trim() ?? '',
    email: norm(r[iEmail] ?? ''),
    phone: (r[iPhone] ?? '').trim(),
    units: (r[iRentals] ?? '').split(/[\s,]+/).map((u) => u.trim()).filter(Boolean),
  }))

  await mongoose.connect(URI!)
  const db = mongoose.connection.db!

  const tenants = await db.collection('tenants').find({}).project({
    firstName: 1, lastName: 1, email: 1, phone: 1, status: 1, archived: 1,
  }).toArray()
  const units = await db.collection('units').find({}).project({
    unitNumber: 1, status: 1, currentTenantId: 1, currentLeaseId: 1,
  }).toArray()
  const leases = await db.collection('leases').find({ status: { $in: ['active', 'pending_moveout'] } }).project({
    tenantId: 1, unitId: 1, status: 1,
  }).toArray()

  const tenantByEmail = new Map(tenants.map((t) => [norm(t.email ?? ''), t]))
  const tenantByName = new Map(tenants.map((t) => [normName(`${t.firstName} ${t.lastName}`), t]))
  const tenantById = new Map(tenants.map((t) => [String(t._id), t]))
  const unitById = new Map(units.map((u) => [String(u._id), u]))

  // DB view: tenantId -> set of unit numbers (from units.currentTenantId AND active leases)
  const dbUnitsByTenant = new Map<string, Set<string>>()
  const add = (tid: string, unitNo: string) => {
    if (!dbUnitsByTenant.has(tid)) dbUnitsByTenant.set(tid, new Set())
    dbUnitsByTenant.get(tid)!.add(unitNo)
  }
  for (const u of units) if (u.currentTenantId) add(String(u.currentTenantId), u.unitNumber)
  for (const l of leases) {
    const u = unitById.get(String(l.unitId))
    if (u) add(String(l.tenantId), u.unitNumber)
  }

  const missing: string[] = []
  const mismatched: string[] = []
  const ok: string[] = []
  const matchedTenantIds = new Set<string>()

  for (const c of customers) {
    if (!c.name && !c.email) continue
    let t = c.email ? tenantByEmail.get(c.email) : undefined
    let how = 'email'
    if (!t) { t = tenantByName.get(normName(c.name)); how = 'name' }
    if (!t) {
      missing.push(`L${c.line} ${c.name} <${c.email}> units=[${c.units.join(', ')}]`)
      continue
    }
    matchedTenantIds.add(String(t._id))
    const dbName = normName(`${t.firstName} ${t.lastName}`)
    const nameNote = dbName !== normName(c.name) ? ` (DB name: "${t.firstName} ${t.lastName}", matched by ${how})` : ''
    const dbUnits = [...(dbUnitsByTenant.get(String(t._id)) ?? [])].sort()
    const csvUnits = [...c.units].sort()
    if (dbUnits.join('|') !== csvUnits.join('|')) {
      mismatched.push(`L${c.line} ${c.name} <${c.email}>${nameNote}: CSV=[${csvUnits.join(', ')}] DB=[${dbUnits.join(', ')}]`)
    } else if (nameNote) {
      mismatched.push(`L${c.line} ${c.name} <${c.email}>${nameNote}: units OK [${csvUnits.join(', ')}]`)
    } else {
      ok.push(`L${c.line} ${c.name} [${csvUnits.join(', ')}]`)
    }
  }

  // Reverse: occupied DB units whose tenant isn't in the CSV at all
  const csvEmails = new Set(customers.map((c) => c.email).filter(Boolean))
  const csvNames = new Set(customers.map((c) => normName(c.name)).filter(Boolean))
  const ghosts: string[] = []
  for (const [tid, unitSet] of dbUnitsByTenant) {
    const t = tenantById.get(tid)
    if (!t) { ghosts.push(`tenant ${tid} (NOT IN tenants collection) holds [${[...unitSet].join(', ')}]`); continue }
    const inCsv = csvEmails.has(norm(t.email ?? '')) || csvNames.has(normName(`${t.firstName} ${t.lastName}`))
    if (!inCsv) ghosts.push(`${t.firstName} ${t.lastName} <${t.email}> (status=${t.status}${t.archived ? ', archived' : ''}) holds [${[...unitSet].join(', ')}] — not in CSV`)
  }

  console.log(`CSV customers: ${customers.length} | DB tenants: ${tenants.length}`)
  console.log(`\n████ MISSING FROM DB (${missing.length}) ████`)
  missing.forEach((m) => console.log('  ' + m))
  console.log(`\n████ MISMATCHES / NAME ISSUES (${mismatched.length}) ████`)
  mismatched.forEach((m) => console.log('  ' + m))
  console.log(`\n████ DB TENANTS WITH UNITS BUT NOT IN CSV (${ghosts.length}) ████`)
  ghosts.forEach((m) => console.log('  ' + m))
  console.log(`\n████ OK (${ok.length}) ████`)
  ok.forEach((m) => console.log('  ' + m))

  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
