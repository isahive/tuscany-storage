import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import { sendAdminNotification } from '@/lib/email'

// ─── GET: Admin — list all move-out requests ──────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const tenantIdParam = searchParams.get('tenantId')

    const filter: Record<string, unknown> = {}
    if (statusParam && ['pending', 'approved', 'denied'].includes(statusParam)) {
      filter.status = statusParam
    }
    if (tenantIdParam) {
      filter.tenantId = tenantIdParam
    }

    const requests = await MoveOutRequest.find(filter)
      .populate('tenantId', 'firstName lastName email')
      .populate('leaseId')
      .populate('unitId')
      .sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ─── POST: Tenant — submit move-out request ───────────────────────────────────
// Storable-parity flow: the tenant picks a date and the request is auto-
// approved. The admin finalizes from the customer detail page when ready.
// The legacy photo/guidelines/card-confirm fields are still accepted for the
// archived flow under app/portal/_move-out-photos/.

const submitMoveOutSchema = z.object({
  // Admin can schedule on behalf of a tenant; ignored when the caller is a tenant.
  tenantId: z.string().optional(),
  leaseId: z.string().optional(),
  requestedMoveOutDate: z.string().datetime({ message: 'Must be a valid ISO date string' }),
  // legacy fields — all optional now
  stripePaymentMethodConfirmed: z.boolean().optional(),
  lastFourDigits: z.string().length(4).optional(),
  photoUrls: z.array(z.string().url()).optional(),
  guidelinesAccepted: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = submitMoveOutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 },
      )
    }

    const {
      tenantId: bodyTenantId,
      leaseId,
      requestedMoveOutDate,
      stripePaymentMethodConfirmed,
      lastFourDigits,
      photoUrls,
    } = parsed.data

    // Admins may schedule on behalf of any tenant; tenants can only act on
    // their own account.
    const isAdmin = session.user.role === 'admin'
    const effectiveTenantId = isAdmin && bodyTenantId ? bodyTenantId : session.user.id

    await connectDB()

    // Resolve the lease — explicit leaseId for multi-rental tenants, else the
    // first active lease on the account.
    const lease = leaseId
      ? await Lease.findOne({ _id: leaseId, tenantId: effectiveTenantId })
      : await Lease.findOne({ tenantId: effectiveTenantId, status: 'active' })

    if (!lease) {
      return NextResponse.json(
        { success: false, error: 'No active lease found for this tenant.' },
        { status: 404 },
      )
    }
    if (lease.status === 'ended') {
      return NextResponse.json(
        { success: false, error: 'This lease has already ended.' },
        { status: 409 },
      )
    }

    // Prevent duplicate pending requests on the same lease
    const existing = await MoveOutRequest.findOne({
      leaseId: lease._id,
      status: 'pending',
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A pending move-out request already exists for this lease.' },
        { status: 409 },
      )
    }

    const requestedDate = new Date(requestedMoveOutDate)

    const moveOutRequest = await MoveOutRequest.create({
      tenantId: effectiveTenantId,
      leaseId: lease._id,
      unitId: lease.unitId,
      requestedMoveOutDate: requestedDate,
      stripePaymentMethodConfirmed: stripePaymentMethodConfirmed ?? false,
      lastFourDigits,
      photoUrls: photoUrls ?? [],
      guidelines: '',
      status: 'pending',
    })

    // Storable-parity: scheduling a move-out flips the lease into
    // pending_moveout and marks the unit as reserved so it shows the
    // "Moving out" state on both portal and admin until finalized.
    lease.status = 'pending_moveout'
    lease.moveOutDate = requestedDate
    await lease.save()

    await Unit.findByIdAndUpdate(lease.unitId, { status: 'reserved' })

    // Notify admin
    const unit = await Unit.findById(lease.unitId).select('unitNumber').lean() as
      | { unitNumber?: string }
      | null
    const firstName = session.user.name?.split(' ')[0] ?? 'Tenant'
    const lastName = session.user.name?.split(' ').slice(1).join(' ') ?? ''

    // Only notify the admin when the tenant initiates the request — admin-
    // initiated schedules are self-evident.
    if (!isAdmin || effectiveTenantId === session.user.id) {
      await sendAdminNotification(
        `Move-Out Request: ${firstName} ${lastName}`.trim(),
        `
          <h2>New Move-Out Request</h2>
          <p><strong>Tenant:</strong> ${firstName} ${lastName}</p>
          <p><strong>Unit:</strong> ${unit?.unitNumber ?? 'N/A'}</p>
          <p><strong>Requested Date:</strong> ${requestedDate.toLocaleDateString('en-US')}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/tenants/${effectiveTenantId}">Review in Admin Panel</a></p>
        `,
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, data: moveOutRequest }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
