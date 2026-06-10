import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import { sendAdminNotification } from '@/lib/email'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

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
    const [unit, tenant] = await Promise.all([
      Unit.findById(lease.unitId).select('unitNumber').lean() as Promise<{ unitNumber?: string } | null>,
      Tenant.findById(effectiveTenantId).select('firstName lastName').lean() as Promise<{ firstName?: string; lastName?: string } | null>,
    ])
    const fullName = `${tenant?.firstName ?? ''} ${tenant?.lastName ?? ''}`.trim() || 'A tenant'
    const unitNumber = unit?.unitNumber ?? 'N/A'
    const formattedDate = requestedDate.toLocaleDateString('en-US')
    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/tenants/${effectiveTenantId}`

    // Only notify the admin when the tenant initiates the request — admin-
    // initiated schedules are self-evident. Body mirrors Storable Easy's
    // verbatim copy so manager workflow expectations carry over.
    if (!isAdmin || effectiveTenantId === session.user.id) {
      await sendAdminNotification(
        'Move Out Request',
        `
          <h2 style="font-family: Arial, Helvetica, sans-serif; color: #1c0f06; margin: 0 0 16px 0;">Move Out Request</h2>
          <p style="font-family: Arial, Helvetica, sans-serif; color: #1c0f06; line-height: 1.6; margin: 0 0 14px 0;">
            ${fullName} has requested a move-out of Unit ${unitNumber} on ${formattedDate} through their online account.
          </p>
          <p style="font-family: Arial, Helvetica, sans-serif; color: #1c0f06; line-height: 1.6; margin: 0 0 14px 0;">
            This request requires you to facilitate and coordinate the move-out with the tenant to ensure that their move-out process is smooth.
          </p>
          <p style="font-family: Arial, Helvetica, sans-serif; color: #1c0f06; line-height: 1.6; margin: 0 0 14px 0;">
            If, per your lease agreement, you require 30 days notice before a move-out can take place, please make sure you adjust the scheduled move-out date accordingly. This can be done on the tenant's account page or the Scheduled Move Out Report in your software.
          </p>
          <p style="font-family: Arial, Helvetica, sans-serif; color: #1c0f06; line-height: 1.6; margin: 0 0 14px 0;">
            <a href="${adminUrl}" style="color: #B8914A; font-weight: 600;">Please log in to view the details.</a>
          </p>
        `,
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, data: moveOutRequest }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
