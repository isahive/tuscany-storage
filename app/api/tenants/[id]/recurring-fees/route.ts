import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RecurringFee, { MANUAL_FEE_CATEGORIES } from '@/models/RecurringFee'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

const createSchema = z.object({
  category: z.enum(['', ...MANUAL_FEE_CATEGORIES] as [string, ...string[]]).optional(),
  customCategory: z.string().optional(),
  startDate: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']),
  amount: z.number().int().nonnegative(), // cents
  taxRate: z.number().min(0).default(0),
  chargeOnDueDate: z.boolean().default(true),
  description: z.string().optional(),
})

// GET — list active recurring fees for the tenant
export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  await connectDB()
  const items = await RecurringFee.find({ tenantId: id, active: true })
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ success: true, data: items })
}

// POST — create a recurring fee
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    // Either a preset category or a custom one — must have at least one.
    const hasCategory = parsed.data.category && parsed.data.category !== ''
    const hasCustom = parsed.data.customCategory && parsed.data.customCategory.trim() !== ''
    if (!hasCategory && !hasCustom) {
      return NextResponse.json(
        { success: false, error: 'Pick a category or enter a custom one.' },
        { status: 400 },
      )
    }

    await connectDB()
    const fee = await RecurringFee.create({
      tenantId: id,
      category: parsed.data.category || '',
      customCategory: parsed.data.customCategory || '',
      startDate: new Date(parsed.data.startDate),
      interval: parsed.data.interval,
      amount: parsed.data.amount,
      taxRate: parsed.data.taxRate,
      chargeOnDueDate: parsed.data.chargeOnDueDate,
      description: parsed.data.description || '',
      active: true,
    })

    return NextResponse.json({ success: true, data: fee })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
