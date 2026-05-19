import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Promotion from '@/models/Promotion'
import { findPromoCodeMatch, normalizePromoCode, type PromotionLike } from '@/lib/promotions'

const schema = z.object({
  code: z.string().min(1),
  unitType: z.string().optional(),
})

// POST /api/promotions/validate-code
// Public — used on the Rental Confirmation page before checkout. Returns the
// matching promo (sans secrets) or `null` so the frontend can render an
// "Invalid promo code" message inline. Case-insensitive.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Missing code' }, { status: 400 })
    }

    await connectDB()

    // Narrow the DB query to candidates with a matching code; case-insensitive
    // via collation. Final filtering (status/dates/unit type) happens in the
    // pure helper so the same rules run on every entry point.
    const candidates = await Promotion.find({
      method: 'promo_code',
      promoCode: { $regex: `^${normalizePromoCode(parsed.data.code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).lean<PromotionLike[]>()

    const match = findPromoCodeMatch(parsed.data.code, candidates, parsed.data.unitType)

    if (!match) {
      return NextResponse.json({ success: true, data: { match: null } })
    }

    return NextResponse.json({
      success: true,
      data: {
        match: {
          // Trimmed payload — never expose internal flags the frontend doesn't need.
          name: (match as any).name,
          description: (match as any).description,
          discountType: (match as any).discountType,
          discountValue: (match as any).discountValue,
          durationCycles: (match as any).durationCycles,
          noExpiration: (match as any).noExpiration,
          beginsImmediately: (match as any).beginsImmediately,
          beginsAfterCycles: (match as any).beginsAfterCycles,
          _id: (match as any)._id,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
