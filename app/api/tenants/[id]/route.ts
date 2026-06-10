import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import { syncTenantToPdkSafe } from '@/lib/pdkSync'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Tenants can only get their own profile
    if (session.user.role !== 'admin' && session.user.id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: tenant })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const updateTenantSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  // Primary address
  address: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  // Alternate contact
  alternateContactName: z.string().optional(),
  alternatePhone: z.string().optional(),
  alternateEmail: z.string().email().optional().or(z.literal('')),
  alternateAddress: z.string().optional(),
  alternateCity: z.string().optional(),
  alternateState: z.string().optional(),
  alternateZip: z.string().optional(),
  // Personal info
  driversLicense: z.string().optional(),
  driversLicenseNumber: z.string().optional(),
  driversLicenseState: z.string().optional(),
  ssn: z.string().optional(),
  employerName: z.string().optional(),
  employerPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  securityQuestion: z.string().optional(),
  securityAnswer: z.string().optional(),
  idPhotoUrl: z.string().optional(),
  idPhotoIsProfile: z.boolean().optional(),
  // Auth / ops
  username: z.string().optional(),
  loginDisabled: z.boolean().optional(),
  role: z.enum(['tenant', 'admin']).optional(),
  status: z.enum(['active', 'delinquent', 'locked_out', 'moved_out']).optional(),
  gateCode: z.string().optional(),
  smsOptIn: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  autopayEnabled: z.boolean().optional(),
  billingDateOffset: z.number().int().min(0).max(31).optional(),
  stripeCustomerId: z.string().optional(),
  defaultPaymentMethodId: z.string().optional(),
  referralSource: z.string().optional(),
  howDidYouHear: z.string().optional(),
  howDidYouHearOther: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  // Notes section
  taxExempt: z.boolean().optional(),
  lateFeeExempt: z.boolean().optional(),
  lateLienNotificationsDisabled: z.boolean().optional(),
  invoiceNote: z.string().optional(),
  notes: z.string().optional(),
  // Lifecycle flags
  archived: z.boolean().optional(),
  onWaitingList: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Tenants can only update their own profile
    if (session.user.role !== 'admin' && session.user.id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateTenantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    // Non-admin tenants cannot change role or status
    const updateData = { ...parsed.data }
    if (session.user.role !== 'admin') {
      delete updateData.role
      delete updateData.status
      delete updateData.stripeCustomerId
      delete updateData.defaultPaymentMethodId
    }

    await connectDB()

    // Snapshot the pre-update name so we know whether to re-push to PDK.
    // Pushing on every PATCH (most of which only touch address/phone) would
    // burn API calls; pushing only on name change keeps PDK aligned without
    // amplifying load.
    const before = await Tenant.findById(id).select('firstName lastName').lean<{
      firstName?: string
      lastName?: string
    } | null>()

    const tenant = await Tenant.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const nameChanged =
      before && (before.firstName !== tenant.firstName || before.lastName !== tenant.lastName)
    if (nameChanged) {
      // Fire-and-forget — local write already succeeded. Reconcile cron is
      // the safety net if PDK is unreachable.
      await syncTenantToPdkSafe(tenant._id as any)
    }

    return NextResponse.json({ success: true, data: tenant })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    await connectDB()

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { status: 'moved_out' },
      { new: true, runValidators: true }
    )
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: tenant })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
