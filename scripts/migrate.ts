import mongoose, { Schema, Document, Types } from 'mongoose'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

// ============ Inline Schema Definitions (for ts-node without @ alias) ============

// --- Tenant ---
interface ITenantDocument extends Document {
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone?: string
  alternateEmail?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  driversLicense?: string
  password: string
  role: 'tenant' | 'admin'
  gateCode?: string
  stripeCustomerId?: string
  defaultPaymentMethodId?: string
  autopayEnabled: boolean
  status: 'active' | 'delinquent' | 'locked_out' | 'moved_out'
  smsOptIn: boolean
  referralSource?: string
  createdAt: Date
  updatedAt: Date
}

const TenantSchema = new Schema<ITenantDocument>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    alternatePhone: { type: String },
    alternateEmail: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    driversLicense: { type: String },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['tenant', 'admin'], default: 'tenant' },
    gateCode: { type: String },
    stripeCustomerId: { type: String },
    defaultPaymentMethodId: { type: String },
    autopayEnabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'delinquent', 'locked_out', 'moved_out'],
      default: 'active',
    },
    smsOptIn: { type: Boolean, default: false },
    referralSource: { type: String },
  },
  { timestamps: true }
)
TenantSchema.index({ email: 1 })
TenantSchema.index({ status: 1 })

// --- Unit ---
interface IUnitDocument extends Document {
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'
  floor: 'ground' | 'upper'
  price: number
  status: 'available' | 'occupied' | 'maintenance' | 'reserved'
  features: string[]
  currentTenantId?: Types.ObjectId
  currentLeaseId?: Types.ObjectId
  notes?: string
}

const UnitSchema = new Schema<IUnitDocument>(
  {
    unitNumber: { type: String, required: true, unique: true, trim: true },
    size: { type: String, required: true },
    width: { type: Number, required: true },
    depth: { type: Number, required: true },
    sqft: { type: Number, required: true },
    type: {
      type: String,
      enum: ['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor'],
      required: true,
    },
    floor: { type: String, enum: ['ground', 'upper'], required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'reserved'],
      default: 'available',
    },
    features: [{ type: String }],
    currentTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    currentLeaseId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    notes: { type: String },
  },
  { timestamps: true }
)
UnitSchema.index({ unitNumber: 1 })
UnitSchema.index({ status: 1 })
UnitSchema.index({ type: 1 })

// --- Lease ---
interface ILeaseDocument extends Document {
  tenantId: Types.ObjectId
  unitId: Types.ObjectId
  startDate: Date
  endDate?: Date
  moveOutDate?: Date
  monthlyRate: number
  deposit: number
  proratedFirstMonth: number
  billingDay: number
  status: 'active' | 'ended' | 'pending_moveout'
  leaseDocumentUrl?: string
  signedAt?: Date
  signatureData?: string
  lastRateChangeDate?: Date
}

const LeaseSchema = new Schema<ILeaseDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    moveOutDate: { type: Date },
    monthlyRate: { type: Number, required: true },
    deposit: { type: Number, required: true, default: 0 },
    proratedFirstMonth: { type: Number, required: true, default: 0 },
    billingDay: { type: Number, required: true, min: 1, max: 28 },
    status: {
      type: String,
      enum: ['active', 'ended', 'pending_moveout'],
      default: 'active',
    },
    leaseDocumentUrl: { type: String },
    signedAt: { type: Date },
    signatureData: { type: String },
    lastRateChangeDate: { type: Date },
  },
  { timestamps: true }
)
LeaseSchema.index({ tenantId: 1 })
LeaseSchema.index({ unitId: 1 })
LeaseSchema.index({ status: 1 })

// ============ Models ============

const Tenant = mongoose.models.Tenant || mongoose.model<ITenantDocument>('Tenant', TenantSchema)
const Unit = mongoose.models.Unit || mongoose.model<IUnitDocument>('Unit', UnitSchema)
const Lease = mongoose.models.Lease || mongoose.model<ILeaseDocument>('Lease', LeaseSchema)

// ============ CSV Parser ============

interface CSVRow {
  [key: string]: string
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: CSVRow = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || '').trim()
    }
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

// ============ Field Mapping ============

// Map common Storable CSV field names to our schema
// Storable exports typically use these column headers
const FIELD_MAP = {
  // Tenant fields
  tenantFirstName: ['First Name', 'FirstName', 'first_name', 'Tenant First Name', 'TenantFirstName'],
  tenantLastName: ['Last Name', 'LastName', 'last_name', 'Tenant Last Name', 'TenantLastName'],
  tenantEmail: ['Email', 'email', 'E-Mail', 'Tenant Email', 'TenantEmail', 'EmailAddress'],
  tenantPhone: ['Phone', 'phone', 'Phone Number', 'PhoneNumber', 'Tenant Phone', 'PrimaryPhone', 'Primary Phone'],
  tenantAltPhone: ['Alt Phone', 'AltPhone', 'Alternate Phone', 'AlternatePhone', 'Secondary Phone'],
  tenantAddress: ['Address', 'address', 'Street Address', 'StreetAddress', 'Mailing Address'],
  tenantCity: ['City', 'city'],
  tenantState: ['State', 'state'],
  tenantZip: ['Zip', 'zip', 'Zip Code', 'ZipCode', 'Postal Code', 'PostalCode'],
  tenantDriversLicense: ['Drivers License', 'DriversLicense', 'DL', 'License Number', 'DL Number'],
  tenantGateCode: ['Gate Code', 'GateCode', 'Access Code', 'AccessCode'],
  tenantStatus: ['Tenant Status', 'TenantStatus', 'Status', 'Account Status'],

  // Unit fields
  unitNumber: ['Unit Number', 'UnitNumber', 'unit_number', 'Space Number', 'SpaceNumber', 'Unit', 'Space'],
  unitSize: ['Unit Size', 'UnitSize', 'Size', 'Dimensions'],
  unitWidth: ['Width', 'width', 'Unit Width'],
  unitDepth: ['Depth', 'depth', 'Length', 'Unit Depth', 'Unit Length'],
  unitType: ['Unit Type', 'UnitType', 'Space Type', 'SpaceType', 'Type'],
  unitFloor: ['Floor', 'floor', 'Level'],
  unitPrice: ['Rate', 'rate', 'Monthly Rate', 'MonthlyRate', 'Price', 'Rent', 'Monthly Rent'],
  unitFeatures: ['Features', 'features', 'Amenities'],

  // Lease fields
  leaseStartDate: ['Move In Date', 'MoveInDate', 'Start Date', 'StartDate', 'Lease Start', 'LeaseStart'],
  leaseEndDate: ['Move Out Date', 'MoveOutDate', 'End Date', 'EndDate', 'Lease End', 'LeaseEnd'],
  leaseBillingDay: ['Billing Day', 'BillingDay', 'Bill Day', 'Payment Day'],
  leaseDeposit: ['Deposit', 'deposit', 'Security Deposit'],
  leaseMonthlyRate: ['Lease Rate', 'LeaseRate', 'Rental Rate', 'RentalRate'],
}

function findField(row: CSVRow, fieldNames: string[]): string {
  for (const name of fieldNames) {
    if (row[name] !== undefined && row[name] !== '') {
      return row[name]
    }
  }
  return ''
}

function parseDollarsToCents(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/[$,\s]/g, '')
  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) return 0
  return Math.round(parsed * 100)
}

function parseDate(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return date
}

function mapUnitType(raw: string): 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor' {
  const lower = raw.toLowerCase()
  if (lower.includes('climate') || lower.includes('cc') || lower.includes('heated') || lower.includes('cooled')) {
    return 'climate_controlled'
  }
  if (lower.includes('drive') || lower.includes('driveup') || lower.includes('drive-up')) {
    return 'drive_up'
  }
  if (lower.includes('vehicle') || lower.includes('parking') || lower.includes('rv') || lower.includes('boat') || lower.includes('outdoor')) {
    return 'vehicle_outdoor'
  }
  return 'standard'
}

function mapUnitFloor(raw: string): 'ground' | 'upper' {
  const lower = raw.toLowerCase()
  if (lower.includes('upper') || lower.includes('2nd') || lower.includes('second') || lower === '2' || lower === 'upstairs') {
    return 'upper'
  }
  return 'ground'
}

function mapTenantStatus(raw: string): 'active' | 'delinquent' | 'locked_out' | 'moved_out' {
  const lower = raw.toLowerCase()
  if (lower.includes('delinquent') || lower.includes('late') || lower.includes('past due')) {
    return 'delinquent'
  }
  if (lower.includes('lock') || lower.includes('denied') || lower.includes('suspended')) {
    return 'locked_out'
  }
  if (lower.includes('moved') || lower.includes('vacated') || lower.includes('former') || lower.includes('inactive')) {
    return 'moved_out'
  }
  return 'active'
}

function parseSizeToWidthDepth(size: string): { width: number; depth: number } {
  // Parse strings like "10x20", "10 x 20", "10X20"
  const match = size.match(/(\d+)\s*[xX×]\s*(\d+)/)
  if (match) {
    return { width: parseInt(match[1], 10), depth: parseInt(match[2], 10) }
  }
  return { width: 0, depth: 0 }
}

function generateTempPassword(): string {
  // Generate a random 12-char password for migrated tenants
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function generateGateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// ============ Main Migration ============

interface MigrationStats {
  tenantsCreated: number
  tenantsSkipped: number
  unitsCreated: number
  unitsSkipped: number
  leasesCreated: number
  leasesSkipped: number
  errors: string[]
}

async function migrate() {
  // Parse CLI arguments
  const args = process.argv.slice(2)
  let filePath = ''
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      filePath = args[i + 1]
      i++
    }
    if (args[i] === '--dry-run') {
      dryRun = true
    }
  }

  if (!filePath) {
    console.error('Usage: ts-node scripts/migrate.ts --file <path-to-csv> [--dry-run]')
    process.exit(1)
  }

  // Resolve path
  const resolvedPath = path.resolve(filePath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`)
    process.exit(1)
  }

  console.log(`[Migrate] Reading CSV: ${resolvedPath}`)
  console.log(`[Migrate] Dry run: ${dryRun}`)

  const csvContent = fs.readFileSync(resolvedPath, 'utf-8')
  const rows = parseCSV(csvContent)

  if (rows.length === 0) {
    console.error('[Migrate] No data rows found in CSV')
    process.exit(1)
  }

  console.log(`[Migrate] Found ${rows.length} rows in CSV`)
  console.log(`[Migrate] CSV headers: ${Object.keys(rows[0]).join(', ')}`)

  // Connect to MongoDB
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany'
  console.log(`[Migrate] Connecting to MongoDB...`)
  await mongoose.connect(MONGODB_URI)
  console.log(`[Migrate] Connected.`)

  const stats: MigrationStats = {
    tenantsCreated: 0,
    tenantsSkipped: 0,
    unitsCreated: 0,
    unitsSkipped: 0,
    leasesCreated: 0,
    leasesSkipped: 0,
    errors: [],
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +2 for 1-indexed + header row

    try {
      // ---- Extract fields ----
      const firstName = findField(row, FIELD_MAP.tenantFirstName)
      const lastName = findField(row, FIELD_MAP.tenantLastName)
      const email = findField(row, FIELD_MAP.tenantEmail).toLowerCase()
      const phone = findField(row, FIELD_MAP.tenantPhone)
      const altPhone = findField(row, FIELD_MAP.tenantAltPhone)
      const address = findField(row, FIELD_MAP.tenantAddress)
      const city = findField(row, FIELD_MAP.tenantCity)
      const state = findField(row, FIELD_MAP.tenantState)
      const zip = findField(row, FIELD_MAP.tenantZip)
      const driversLicense = findField(row, FIELD_MAP.tenantDriversLicense)
      const gateCode = findField(row, FIELD_MAP.tenantGateCode) || generateGateCode()
      const statusRaw = findField(row, FIELD_MAP.tenantStatus)

      const unitNumber = findField(row, FIELD_MAP.unitNumber)
      const unitSizeRaw = findField(row, FIELD_MAP.unitSize)
      const unitWidthRaw = findField(row, FIELD_MAP.unitWidth)
      const unitDepthRaw = findField(row, FIELD_MAP.unitDepth)
      const unitTypeRaw = findField(row, FIELD_MAP.unitType)
      const unitFloorRaw = findField(row, FIELD_MAP.unitFloor)
      const unitPriceRaw = findField(row, FIELD_MAP.unitPrice)
      const unitFeaturesRaw = findField(row, FIELD_MAP.unitFeatures)

      const leaseStartRaw = findField(row, FIELD_MAP.leaseStartDate)
      const leaseEndRaw = findField(row, FIELD_MAP.leaseEndDate)
      const billingDayRaw = findField(row, FIELD_MAP.leaseBillingDay)
      const depositRaw = findField(row, FIELD_MAP.leaseDeposit)
      const leaseRateRaw = findField(row, FIELD_MAP.leaseMonthlyRate)

      // Validate minimum required fields
      if (!email) {
        console.warn(`[Migrate] Row ${rowNum}: No email found, skipping`)
        stats.errors.push(`Row ${rowNum}: No email`)
        continue
      }

      if (!firstName && !lastName) {
        console.warn(`[Migrate] Row ${rowNum}: No name found for ${email}, skipping`)
        stats.errors.push(`Row ${rowNum}: No name for ${email}`)
        continue
      }

      // ---- Tenant ----
      const tenantStatus = mapTenantStatus(statusRaw)
      let tenantDoc = await Tenant.findOne({ email })

      if (tenantDoc) {
        console.log(`[Migrate] Row ${rowNum}: Tenant ${email} already exists, skipping tenant creation`)
        stats.tenantsSkipped++
      } else {
        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 12)

        const tenantData = {
          firstName: firstName || 'Unknown',
          lastName: lastName || 'Unknown',
          email,
          phone: phone || '000-000-0000',
          alternatePhone: altPhone || undefined,
          address: address || undefined,
          city: city || undefined,
          state: state || undefined,
          zip: zip || undefined,
          driversLicense: driversLicense || undefined,
          password: hashedPassword,
          role: 'tenant' as const,
          gateCode,
          autopayEnabled: false,
          status: tenantStatus,
          smsOptIn: false,
          referralSource: 'storable_migration',
        }

        if (dryRun) {
          console.log(`[Migrate][DRY RUN] Row ${rowNum}: Would create tenant: ${firstName} ${lastName} <${email}> (temp password: ${tempPassword})`)
        } else {
          tenantDoc = await Tenant.create(tenantData)
          console.log(`[Migrate] Row ${rowNum}: Created tenant: ${firstName} ${lastName} <${email}> (ID: ${tenantDoc._id})`)
        }
        stats.tenantsCreated++
      }

      // ---- Unit ----
      if (!unitNumber) {
        console.log(`[Migrate] Row ${rowNum}: No unit number for ${email}, skipping unit/lease`)
        continue
      }

      let unitDoc = await Unit.findOne({ unitNumber })

      if (unitDoc) {
        console.log(`[Migrate] Row ${rowNum}: Unit ${unitNumber} already exists, skipping unit creation`)
        stats.unitsSkipped++
      } else {
        let width = parseInt(unitWidthRaw, 10) || 0
        let depth = parseInt(unitDepthRaw, 10) || 0

        // Try parsing from size string if width/depth not provided
        if ((!width || !depth) && unitSizeRaw) {
          const parsed = parseSizeToWidthDepth(unitSizeRaw)
          width = width || parsed.width
          depth = depth || parsed.depth
        }

        const sqft = width * depth
        const unitType = mapUnitType(unitTypeRaw)
        const floor = mapUnitFloor(unitFloorRaw)
        const price = parseDollarsToCents(unitPriceRaw || leaseRateRaw)
        const features = unitFeaturesRaw
          ? unitFeaturesRaw.split(/[;|,]/).map((f) => f.trim()).filter(Boolean)
          : []

        const size = width && depth ? `${width}x${depth}` : unitSizeRaw || 'unknown'

        const unitData = {
          unitNumber,
          size,
          width: width || 0,
          depth: depth || 0,
          sqft: sqft || 0,
          type: unitType,
          floor,
          price,
          status: (tenantStatus !== 'moved_out' ? 'occupied' : 'available') as 'available' | 'occupied',
          features,
          currentTenantId: tenantDoc ? tenantDoc._id : undefined,
        }

        if (dryRun) {
          console.log(`[Migrate][DRY RUN] Row ${rowNum}: Would create unit: ${unitNumber} (${size}, ${unitType}, $${(price / 100).toFixed(2)}/mo)`)
        } else {
          unitDoc = await Unit.create(unitData)
          console.log(`[Migrate] Row ${rowNum}: Created unit: ${unitNumber} (ID: ${unitDoc._id})`)
        }
        stats.unitsCreated++
      }

      // ---- Lease (only for active/delinquent/locked_out tenants) ----
      if (tenantStatus === 'moved_out') {
        console.log(`[Migrate] Row ${rowNum}: Tenant ${email} is moved out, skipping lease creation`)
        continue
      }

      if (!tenantDoc || !unitDoc) {
        if (dryRun) {
          console.log(`[Migrate][DRY RUN] Row ${rowNum}: Would create lease for ${email} on unit ${unitNumber}`)
          stats.leasesCreated++
        }
        continue
      }

      // Check if lease already exists for this tenant+unit combo
      const existingLease = await Lease.findOne({
        tenantId: tenantDoc._id,
        unitId: unitDoc._id,
        status: 'active',
      })

      if (existingLease) {
        console.log(`[Migrate] Row ${rowNum}: Lease already exists for ${email} on unit ${unitNumber}, skipping`)
        stats.leasesSkipped++
        continue
      }

      const startDate = parseDate(leaseStartRaw) || new Date()
      const endDate = parseDate(leaseEndRaw) || undefined
      const billingDay = Math.max(1, Math.min(28, parseInt(billingDayRaw, 10) || startDate.getDate() || 1))
      const monthlyRate = parseDollarsToCents(leaseRateRaw || unitPriceRaw)
      const deposit = parseDollarsToCents(depositRaw)

      const leaseData = {
        tenantId: tenantDoc._id,
        unitId: unitDoc._id,
        startDate,
        endDate,
        monthlyRate,
        deposit,
        proratedFirstMonth: 0,
        billingDay,
        status: 'active' as const,
      }

      if (dryRun) {
        console.log(`[Migrate][DRY RUN] Row ${rowNum}: Would create lease: ${email} -> unit ${unitNumber} ($${(monthlyRate / 100).toFixed(2)}/mo, billing day ${billingDay})`)
      } else {
        const leaseDoc = await Lease.create(leaseData)
        console.log(`[Migrate] Row ${rowNum}: Created lease: ${email} -> unit ${unitNumber} (ID: ${leaseDoc._id})`)

        // Update unit with lease reference
        await Unit.findByIdAndUpdate(unitDoc._id, {
          currentTenantId: tenantDoc._id,
          currentLeaseId: leaseDoc._id,
          status: 'occupied',
        })
      }
      stats.leasesCreated++
    } catch (err: any) {
      const msg = `Row ${rowNum}: ${err.message}`
      console.error(`[Migrate] Error - ${msg}`)
      stats.errors.push(msg)
    }
  }

  // ---- Summary ----
  console.log('\n========================================')
  console.log('[Migrate] Migration Summary')
  console.log('========================================')
  console.log(`  Tenants created: ${stats.tenantsCreated}`)
  console.log(`  Tenants skipped (already exist): ${stats.tenantsSkipped}`)
  console.log(`  Units created: ${stats.unitsCreated}`)
  console.log(`  Units skipped (already exist): ${stats.unitsSkipped}`)
  console.log(`  Leases created: ${stats.leasesCreated}`)
  console.log(`  Leases skipped (already exist): ${stats.leasesSkipped}`)
  console.log(`  Errors: ${stats.errors.length}`)
  if (stats.errors.length > 0) {
    console.log('  Error details:')
    stats.errors.forEach((e) => console.log(`    - ${e}`))
  }
  if (dryRun) {
    console.log('\n  ** DRY RUN — no records were actually created **')
  }
  console.log('========================================\n')

  await mongoose.disconnect()
  console.log('[Migrate] Done.')
}

migrate().catch((err) => {
  console.error('[Migrate] Fatal error:', err)
  process.exit(1)
})
