import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'

// ── Default settings returned when no document exists yet ────────────────────

const DEFAULT_SETTINGS = {
  facilityName: 'Tuscany Village Self Storage',
  facilityAddress: '',
  facilityCity: '',
  facilityState: 'TN',
  facilityZip: '',
  facilityPhone: '(865) 426-2100',
  facilityEmail: '',
  accessHoursStart: '05:00',
  accessHoursEnd: '22:00',
  lateFeeAfterDays: 5,
  lateFeeAmount: 2000,
  nsfFeeAmount: 3500,
  auctionFeeAmount: 5000,
  agreementTemplate: '',
}

// ── Validation schema (all fields optional — partial update) ─────────────────

const updateSettingsSchema = z
  .object({
    facilityName: z.string(),
    facilityAddress: z.string(),
    facilityCity: z.string(),
    facilityState: z.string(),
    facilityZip: z.string(),
    facilityPhone: z.string(),
    facilityEmail: z.string(),
    accessHoursStart: z.string(),
    accessHoursEnd: z.string(),
    lateFeeAfterDays: z.number().int().min(0),
    lateFeeAmount: z.number().int().min(0),
    nsfFeeAmount: z.number().int().min(0),
    auctionFeeAmount: z.number().int().min(0),
    agreementTemplate: z.string(),
  })
  .partial()

// ── GET /api/settings ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const settings = await Settings.findOne({})

    return NextResponse.json({
      success: true,
      data: settings ?? DEFAULT_SETTINGS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── PUT /api/settings ────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    return NextResponse.json({ success: true, data: updatedSettings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
