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

  // Create units
  const units = [
    {
      unitNumber: '101',
      size: '5x10',
      width: 5,
      depth: 10,
      sqft: 50,
      type: 'standard',
      floor: 'ground',
      price: 7500, // $75.00
      status: 'available',
      features: ['Ground floor', 'LED lighting'],
    },
    {
      unitNumber: '102',
      size: '10x10',
      width: 10,
      depth: 10,
      sqft: 100,
      type: 'climate_controlled',
      floor: 'ground',
      price: 12500, // $125.00
      status: 'occupied',
      features: ['Climate controlled', 'Ground floor', 'LED lighting'],
    },
    {
      unitNumber: '103',
      size: '10x10',
      width: 10,
      depth: 10,
      sqft: 100,
      type: 'standard',
      floor: 'upper',
      price: 10000, // $100.00
      status: 'occupied',
      features: ['LED lighting', 'Elevator access'],
    },
    {
      unitNumber: '201',
      size: '10x15',
      width: 10,
      depth: 15,
      sqft: 150,
      type: 'drive_up',
      floor: 'ground',
      price: 16500, // $165.00
      status: 'occupied',
      features: ['Drive-up access', 'Ground floor', 'Wide door'],
    },
    {
      unitNumber: '202',
      size: '10x20',
      width: 10,
      depth: 20,
      sqft: 200,
      type: 'drive_up',
      floor: 'ground',
      price: 20000, // $200.00
      status: 'available',
      features: ['Drive-up access', 'Ground floor', 'Extra tall ceiling'],
    },
    {
      unitNumber: '301',
      size: '10x30',
      width: 10,
      depth: 30,
      sqft: 300,
      type: 'vehicle_outdoor',
      floor: 'ground',
      price: 25000, // $250.00
      status: 'available',
      features: ['Outdoor parking', 'Wide access', 'Security cameras'],
    },
  ]

  const unitDocs = units.map((u) => ({
    ...u,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const unitResult = await db.collection('units').insertMany(unitDocs)
  const unitIds = Object.values(unitResult.insertedIds)
  console.log('Units created:', unitIds.length)

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

  // Create leases for tenants (units 102, 103, 201)
  const now = new Date()
  const leaseStart = new Date(now.getFullYear(), now.getMonth() - 3, 1) // 3 months ago
  const leases = [
    {
      tenantId: tenantIds[0],
      unitId: unitIds[1], // 102
      startDate: leaseStart,
      monthlyRate: 12500,
      deposit: 12500,
      proratedFirstMonth: 12500,
      billingDay: 1,
      status: 'active',
      createdAt: leaseStart,
      updatedAt: new Date(),
    },
    {
      tenantId: tenantIds[1],
      unitId: unitIds[2], // 103
      startDate: leaseStart,
      monthlyRate: 10000,
      deposit: 10000,
      proratedFirstMonth: 10000,
      billingDay: 1,
      status: 'active',
      createdAt: leaseStart,
      updatedAt: new Date(),
    },
    {
      tenantId: tenantIds[2],
      unitId: unitIds[3], // 201
      startDate: leaseStart,
      monthlyRate: 16500,
      deposit: 16500,
      proratedFirstMonth: 16500,
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
    { _id: unitIds[1] },
    { $set: { currentTenantId: tenantIds[0], currentLeaseId: leaseIds[0] } }
  )
  await db.collection('units').updateOne(
    { _id: unitIds[2] },
    { $set: { currentTenantId: tenantIds[1], currentLeaseId: leaseIds[1] } }
  )
  await db.collection('units').updateOne(
    { _id: unitIds[3] },
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
