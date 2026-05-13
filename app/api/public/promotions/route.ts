import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Promotion from '@/models/Promotion'

// GET /api/public/promotions — public, no auth. Returns currently-active promotions.
export async function GET() {
  try {
    await connectDB()
    const now = new Date()

    const promos = await Promotion.find({
      status: 'active',
      method: 'automatic',
      startDate: { $lte: now },
      $or: [{ noExpiration: true }, { endDate: null }, { endDate: { $gte: now } }],
    })
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ success: true, data: promos })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
