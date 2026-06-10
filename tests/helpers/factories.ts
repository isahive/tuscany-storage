import { Types } from 'mongoose'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'

let counter = 1
const next = () => String(counter++).padStart(4, '0')

/** Make a saved Tenant with reasonable defaults. Override anything via opts. */
export async function makeTenant(opts: Partial<Record<string, unknown>> = {}) {
  const n = next()
  return Tenant.create({
    firstName: opts.firstName ?? `Test${n}`,
    lastName:  opts.lastName ?? `Tenant${n}`,
    email:     opts.email ?? `tenant-${n}@test.local`,
    phone:     opts.phone ?? `555-000-${n}`,
    password:  opts.password ?? 'test-password-hash',
    status:    opts.status ?? 'active',
    role:      opts.role ?? 'tenant',
    autopayEnabled: opts.autopayEnabled ?? false,
    smsOptIn:  opts.smsOptIn ?? false,
    ...opts,
  })
}

/** Make a saved Unit. */
export async function makeUnit(opts: Partial<Record<string, unknown>> = {}) {
  const n = next()
  return Unit.create({
    unitNumber: opts.unitNumber ?? `U${n}`,
    size:       opts.size ?? '10x10',
    width:      opts.width ?? 10,
    depth:      opts.depth ?? 10,
    sqft:       opts.sqft ?? 100,
    type:       opts.type ?? 'standard',
    price:      opts.price ?? 10000,
    monthlyRate: opts.monthlyRate ?? 10000,
    status:     opts.status ?? 'available',
    ...opts,
  })
}

/** Make a saved Lease tying a Tenant to a Unit. */
export async function makeLease(
  tenantId: string | Types.ObjectId,
  unitId: string | Types.ObjectId,
  opts: Partial<Record<string, unknown>> = {},
) {
  return Lease.create({
    tenantId,
    unitId,
    startDate:   opts.startDate ?? new Date('2026-01-01'),
    monthlyRate: opts.monthlyRate ?? 10000,
    deposit:     opts.deposit ?? 0,
    billingDay:  opts.billingDay ?? 1,
    status:      opts.status ?? 'active',
    ...opts,
  })
}

/** Convenience: tenant + unit + active lease in one call. */
export async function makeRentedTenant(opts: { tenantOpts?: Record<string, unknown>; unitOpts?: Record<string, unknown>; leaseOpts?: Record<string, unknown> } = {}) {
  const tenant = await makeTenant(opts.tenantOpts)
  const unit = await makeUnit({ status: 'occupied', currentTenantId: tenant._id, ...opts.unitOpts })
  const lease = await makeLease(tenant._id, unit._id, opts.leaseOpts)
  await Unit.findByIdAndUpdate(unit._id, { currentLeaseId: lease._id })
  return { tenant, unit, lease }
}
