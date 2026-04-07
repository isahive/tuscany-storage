import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Types } from 'mongoose'
import Unit from '@/models/Unit'

const positionsSchema = z.object({
  positions: z.array(
    z.object({
      id: z.string().refine((val) => Types.ObjectId.isValid(val), { message: 'Invalid unit id' }),
      gridX: z.number().int().min(0),
      gridY: z.number().int().min(0),
      gridFloor: z.number().int().min(1),
    })
  ).min(1),
})

// PATCH /api/units/positions
// Body: { positions: Array<{ id: string, gridX: number, gridY: number, gridFloor: number }> }
// Auth: admin only
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = positionsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const results = await Promise.all(
      parsed.data.positions.map(({ id, gridX, gridY, gridFloor }) =>
        Unit.findByIdAndUpdate(
          id,
          { gridX, gridY, gridFloor },
          { new: true, runValidators: true }
        )
      )
    )

    const updated = results.filter(Boolean).length

    return NextResponse.json({ success: true, data: { updated } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
