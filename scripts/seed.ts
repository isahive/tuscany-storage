import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Direct imports for script context (no @ alias in ts-node)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function seed() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected.')

  const db = mongoose.connection.db!

  // Clear existing data
  const collections = ['tenants', 'units', 'leases', 'payments', 'accesslogs', 'notifications', 'waitinglists']
  for (const col of collections) {
    try {
      await db.collection(col).drop()
    } catch {
      // Collection might not exist
    }
  }

  // Create admin
  const adminPassword = await bcrypt.hash('admin123', 12)
  const adminResult = await db.collection('tenants').insertOne({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@tuscanystorage.com',
    phone: '555-000-0000',
    password: adminPassword,
    role: 'admin',
    autopayEnabled: false,
    status: 'active',
    smsOptIn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  console.log('Admin created:', adminResult.insertedId)

  // Create units — exact catalog from live tuscanystorage.com (163 units).
  // Seeded WITHOUT grid positions so all units appear in the canvas sidebar
  // as "Unplaced" and admin can lay them out via /admin/units/canvas.
  // Prices stored at BASE (pre-promo); /units page applies the 1/2-off display.
  type SeedUnit = {
    unitNumber: string
    size: string
    width: number
    depth: number
    sqft: number
    type: 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'
    floor: 'ground' | 'upper'
    price: number
    status: 'available' | 'occupied' | 'reserved' | 'maintenance'
    features: string[]
  }

  // Catalog of unit numbers per size (taken from live site listing)
  const CATALOG = {
    '5x10': [
      'A9','A10','A11','A12','A13','A14','A23','A24','A25','A26','A27','A28',
      'B9','B10','B11','B12','B13','B22','B23','B24','B25','B26',
      'C9','C10','C11','C12','C13','C14','C23','C24','C25','C26','C27','C28',
      'D10','D11','D12','D13','D14','D15',
    ],
    '10x10': [
      'A7','A18','A19','A20','A21',
      'B8','B15','B16','B17','B18','B19','B20','B21',
      'G1','G2','G3','G4',
    ],
    '10x15': [
      'A1','A6','A8','A15','A17','A22',
      'B1','B2','B3','B4','B5','B6','B7','B14',
      'C1','C2','C3','C4','C5','C6','C7','C8',
      'C15','C16','C17','C18','C19','C20','C21','C22',
      'D1','D2','D3','D4','D5','D6','D7','D8','D9',
      'D16','D17','D18','D19','D20','D21','D22','D23','D24',
    ],
    '10x20': [
      'A2','A3','A4','A5','A16',
      'G5','G6','G7','G8','G9','G10','G11','G12','G13','G14','G15','G16',
      'H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','H11','H12',
    ],
    '10x30': [
      '1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16',
    ],
    '10x30_rv': [
      'P14','P15','P16','P17','P18','P19','P20','P21','P22','P23','P24','P25','P26',
    ],
  }

  // Spec per size: dimensions, type, price (base / pre-promo), features,
  // and how many of them should be "available" (rest = occupied).
  const SPECS: Record<keyof typeof CATALOG, {
    size: string
    width: number
    depth: number
    sqft: number
    type: SeedUnit['type']
    price: number
    features: string[]
    availableCount: number
  }> = {
    '5x10': {
      size: '5x10', width: 5, depth: 10, sqft: 50,
      type: 'standard', price: 6500,
      features: ['Ground floor', 'Roll-up door', '24/7 gate access'],
      availableCount: 5,
    },
    '10x10': {
      size: '10x10', width: 10, depth: 10, sqft: 100,
      type: 'standard', price: 11000,
      features: ['Ground floor', 'Roll-up door', '24/7 gate access'],
      availableCount: 3,
    },
    '10x15': {
      size: '10x15', width: 10, depth: 15, sqft: 150,
      type: 'drive_up', price: 12000,
      features: ['Drive-up access', 'Ground floor', 'Wide door'],
      availableCount: 0,
    },
    '10x20': {
      size: '10x20', width: 10, depth: 20, sqft: 200,
      type: 'drive_up', price: 14000,
      features: ['Drive-up access', 'Ground floor', 'Extra tall ceiling'],
      availableCount: 0,
    },
    '10x30': {
      size: '10x30', width: 10, depth: 30, sqft: 300,
      type: 'drive_up', price: 18000,
      features: ['Drive-up access', 'Roll-up door', 'Wide access'],
      availableCount: 0,
    },
    '10x30_rv': {
      size: '10x30', width: 10, depth: 30, sqft: 300,
      type: 'vehicle_outdoor', price: 8000,
      features: ['Open air parking', 'Fits boats, RVs & campers', '24/7 gate access'],
      availableCount: 0,
    },
  }

  const units: SeedUnit[] = []
  for (const [key, numbers] of Object.entries(CATALOG) as [keyof typeof CATALOG, string[]][]) {
    const spec = SPECS[key]
    numbers.forEach((unitNumber, i) => {
      units.push({
        unitNumber,
        size: spec.size,
        width: spec.width,
        depth: spec.depth,
        sqft: spec.sqft,
        type: spec.type,
        floor: 'ground',
        price: spec.price,
        status: i < spec.availableCount ? 'available' : 'occupied',
        features: spec.features,
      })
    })
  }

  const unitDocs = units.map((u) => ({
    ...u,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const unitResult = await db.collection('units').insertMany(unitDocs)
  const unitIds = Object.values(unitResult.insertedIds)
  console.log('Units created:', unitIds.length)

  // ── Promotions ────────────────────────────────────────────────────────
  try {
    await db.collection('promotions').drop()
  } catch {
    // collection may not exist
  }
  await db.collection('promotions').insertOne({
    name: 'Move-in Special',
    description: '1/2 off FIRST month. Prorated second month. After full deposit.',
    method: 'automatic',
    promoCode: '',
    discountType: 'percentage',
    discountValue: 50,
    unitTypes: [],
    allUnitTypes: true,
    startDate: new Date(),
    endDate: null,
    beginsImmediately: true,
    beginsAfterCycles: 0,
    noExpiration: true,
    durationCycles: 1,
    status: 'active',
    appliedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  console.log('Promotion created: Move-in Special')

  // Create tenants
  const tenantPassword = await bcrypt.hash('tenant123', 12)
  const tenants = [
    {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '555-111-1111',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '90210',
      password: tenantPassword,
      role: 'tenant',
      gateCode: '1234',
      autopayEnabled: true,
      status: 'active',
      smsOptIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-222-2222',
      address: '456 Oak Ave',
      city: 'Somewhere',
      state: 'CA',
      zip: '90211',
      password: tenantPassword,
      role: 'tenant',
      gateCode: '5678',
      autopayEnabled: false,
      status: 'active',
      smsOptIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@example.com',
      phone: '555-333-3333',
      password: tenantPassword,
      role: 'tenant',
      gateCode: '9012',
      autopayEnabled: false,
      status: 'delinquent',
      smsOptIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const tenantResult = await db.collection('tenants').insertMany(tenants)
  const tenantIds = Object.values(tenantResult.insertedIds)
  console.log('Tenants created:', tenantIds.length)

  // Create leases for tenants — pick first 3 occupied units regardless of size
  const now = new Date()
  const leaseStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  const occupiedIdxs: number[] = []
  units.forEach((u, i) => { if (u.status === 'occupied') occupiedIdxs.push(i) })
  const [li0, li1, li2] = occupiedIdxs

  const leases = [
    {
      tenantId: tenantIds[0],
      unitId: unitIds[li0],
      startDate: leaseStart,
      monthlyRate: units[li0].price,
      deposit: units[li0].price,
      proratedFirstMonth: units[li0].price,
      billingDay: 1,
      status: 'active',
      createdAt: leaseStart,
      updatedAt: new Date(),
    },
    {
      tenantId: tenantIds[1],
      unitId: unitIds[li1],
      startDate: leaseStart,
      monthlyRate: units[li1].price,
      deposit: units[li1].price,
      proratedFirstMonth: units[li1].price,
      billingDay: 1,
      status: 'active',
      createdAt: leaseStart,
      updatedAt: new Date(),
    },
    {
      tenantId: tenantIds[2],
      unitId: unitIds[li2],
      startDate: leaseStart,
      monthlyRate: units[li2].price,
      deposit: units[li2].price,
      proratedFirstMonth: units[li2].price,
      billingDay: 1,
      status: 'active',
      createdAt: leaseStart,
      updatedAt: new Date(),
    },
  ]

  const leaseResult = await db.collection('leases').insertMany(leases)
  const leaseIds = Object.values(leaseResult.insertedIds)
  console.log('Leases created:', leaseIds.length)

  // Update units with tenant/lease references
  await db.collection('units').updateOne(
    { _id: unitIds[li0] },
    { $set: { currentTenantId: tenantIds[0], currentLeaseId: leaseIds[0] } }
  )
  await db.collection('units').updateOne(
    { _id: unitIds[li1] },
    { $set: { currentTenantId: tenantIds[1], currentLeaseId: leaseIds[1] } }
  )
  await db.collection('units').updateOne(
    { _id: unitIds[li2] },
    { $set: { currentTenantId: tenantIds[2], currentLeaseId: leaseIds[2] } }
  )

  console.log('\nSeed complete!')
  console.log('Admin login: admin@tuscanystorage.com / admin123')
  console.log('Tenant login: john@example.com / tenant123')

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
