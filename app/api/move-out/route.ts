import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'

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

    const filter: Record<string, unknown> = {}
    if (statusParam && ['pending', 'approved', 'denied'].includes(statusParam)) {
      filter.status = statusParam
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

// ─── POST: Authenticated tenant — submit move-out request ─────────────────────

const submitMoveOutSchema = z.object({
  requestedMoveOutDate: z.string().datetime({ message: 'Must be a valid ISO date string' }),
  stripePaymentMethodConfirmed: z.boolean(),
  lastFourDigits: z.string().length(4).optional(),
  photoUrls: z.array(z.string().url()).optional(),
  guidelinesAccepted: z.boolean(),
})

const GUIDELINES_TEXT = [
  'I will remove all belongings by the move-out date',
  'I will clean the unit and return it in original condition',
  'I understand final month may be prorated',
  'I confirm there are no outstanding balances',
].join('\n')

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

    const { requestedMoveOutDate, stripePaymentMethodConfirmed, lastFourDigits, photoUrls, guidelinesAccepted } =
      parsed.data

    if (!guidelinesAccepted) {
      return NextResponse.json(
        { success: false, error: 'You must accept all move-out guidelines to proceed.' },
        { status: 422 },
      )
    }

    await connectDB()

    // Find the tenant's active lease
    const activeLease = await Lease.findOne({
      tenantId: session.user.id,
      status: 'active',
    })

    if (!activeLease) {
      return NextResponse.json(
        { success: false, error: 'No active lease found for this tenant.' },
        { status: 404 },
      )
    }

    // Prevent duplicate pending requests
    const existing = await MoveOutRequest.findOne({
      tenantId: session.user.id,
      leaseId: activeLease._id,
      status: 'pending',
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A pending move-out request already exists for this lease.' },
        { status: 409 },
      )
    }

    const moveOutRequest = await MoveOutRequest.create({
      tenantId: session.user.id,
      leaseId: activeLease._id,
      unitId: activeLease.unitId,
      requestedMoveOutDate: new Date(requestedMoveOutDate),
      stripePaymentMethodConfirmed,
      lastFourDigits,
      photoUrls: photoUrls ?? [],
      guidelines: GUIDELINES_TEXT,
      status: 'pending',
    })

    // TODO: send email notification to admin alerting them of a new move-out request

    return NextResponse.json({ success: true, data: moveOutRequest }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
