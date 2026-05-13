import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

// GET /api/admin/fees
// Returns every active fee from Settings.customFees. There are no hardcoded
// fee labels anywhere — the entire dropdown / catalogue comes from the DB.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const s = await Settings.findOne({}).lean()
    const all = ((s?.customFees as any[]) ?? DEFAULT_SETTINGS.customFees) as Array<{
      id: string
      code?: string
      name: string
      amount: number
      description: string
      active?: boolean
    }>

    const fees = all
      .filter((f) => f.active !== false)
      .map((f) => ({
        id: f.id,
        name: f.name,
        amount: f.amount,
        description: f.description ?? '',
        code: f.code ?? null,
        active: f.active !== false,
      }))

    return NextResponse.json({ success: true, data: fees })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
