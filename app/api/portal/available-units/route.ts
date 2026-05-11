import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'

// GET /api/portal/available-units
// Lists units the tenant can rent additionally (status: available).
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const units = await Unit.find({ status: 'available' })
      .sort({ price: 1 })
      .select('unitNumber size width depth sqft type floor price features')
      .lean()

    return NextResponse.json({
      success: true,
      data: units.map((u) => ({
        _id: u._id.toString(),
        unitNumber: u.unitNumber,
        size: u.size,
        sqft: u.sqft,
        type: u.type,
        floor: u.floor,
        price: u.price,
        features: u.features ?? [],
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
