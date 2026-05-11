import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Promotion from '@/models/Promotion'
import ProtectionPlan from '@/models/ProtectionPlan'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { calculateCharges } from '@/lib/billing/calculate-charges'

const schema = z.object({
  unitId: z.string().min(1),
  signDate: z.string().optional(),
  promoCode: z.string().optional(),
  protectionPlanId: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      )
    }

    const { unitId, signDate, promoCode, protectionPlanId } = parsed.data

    await connectDB()

    const unit = await Unit.findById(unitId).lean()
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }
    if ((unit as any).status !== 'available') {
      return NextResponse.json({ success: false, error: 'Unit is not available' }, { status: 404 })
    }

    const settingsDoc = await Settings.findOne({}).lean()
    const settings = { ...DEFAULT_SETTINGS, ...(settingsDoc || {}) } as any

    const sd = signDate ? new Date(signDate) : new Date()
    if (isNaN(sd.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid signDate' }, { status: 400 })
    }

    let appliedPromotion: any = null
    let promoCodeError: string | null = null
    if (promoCode && promoCode.trim().length > 0) {
      const code = promoCode.trim().toUpperCase()
      const promo: any = await Promotion.findOne({
        promoCode: { $regex: new RegExp(`^${code}$`, 'i') },
        status: 'active',
      }).lean()

      if (!promo) {
        promoCodeError = 'Promo code not found'
      } else {
        const now = sd
        const start = promo.startDate ? new Date(promo.startDate) : null
        const end = promo.noExpiration ? null : promo.endDate ? new Date(promo.endDate) : null
        if (start && now < start) {
          promoCodeError = 'Promo code is not yet active'
        } else if (end && now > end) {
          promoCodeError = 'Promo code has expired'
        } else if (
          !promo.allUnitTypes &&
          Array.isArray(promo.unitTypes) &&
          promo.unitTypes.length > 0 &&
          !promo.unitTypes.includes((unit as any).type)
        ) {
          promoCodeError = 'Promo code does not apply to this unit type'
        } else {
          appliedPromotion = promo
        }
      }
    }

    let appliedProtectionPlan: any = null
    if (protectionPlanId) {
      const plan: any = await ProtectionPlan.findById(protectionPlanId).lean()
      if (plan && plan.status === 'active') {
        appliedProtectionPlan = plan
      }
    }

    const breakdown = calculateCharges({
      unit: {
        _id: String((unit as any)._id),
        size: (unit as any).size,
        type: (unit as any).type,
        price: (unit as any).price,
      },
      signDate: sd,
      settings: {
        billingCycleAnchor: settings.billingCycleAnchor,
        billingCycleCustomDay: settings.billingCycleCustomDay,
        prorationModel: settings.prorationModel,
        prorationDaysBasis: settings.prorationDaysBasis,
        taxRate: settings.taxRate ?? 0,
      },
      promotion: appliedPromotion
        ? {
            _id: String(appliedPromotion._id),
            name: appliedPromotion.name,
            description: appliedPromotion.description,
            discountType: appliedPromotion.discountType,
            discountValue: appliedPromotion.discountValue,
            durationCycles: appliedPromotion.durationCycles,
            noExpiration: appliedPromotion.noExpiration,
            beginsImmediately: appliedPromotion.beginsImmediately,
            beginsAfterCycles: appliedPromotion.beginsAfterCycles,
          }
        : null,
      protectionPlan: appliedProtectionPlan
        ? {
            _id: String(appliedProtectionPlan._id),
            name: appliedProtectionPlan.name,
            monthlyPrice: appliedProtectionPlan.monthlyPrice,
          }
        : null,
      depositAmount: (unit as any).price,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...breakdown,
        unit: {
          id: String((unit as any)._id),
          unitNumber: (unit as any).unitNumber,
          size: (unit as any).size,
          monthlyPrice: (unit as any).price,
        },
        appliedPromotion: appliedPromotion
          ? {
              id: String(appliedPromotion._id),
              name: appliedPromotion.name,
              description: appliedPromotion.description,
              effectiveCycles: breakdown.appliedPromotion?.effectiveCycles ?? null,
            }
          : null,
        appliedProtectionPlan: appliedProtectionPlan
          ? {
              id: String(appliedProtectionPlan._id),
              name: appliedProtectionPlan.name,
              monthlyPrice: appliedProtectionPlan.monthlyPrice,
              coverageAmount: appliedProtectionPlan.coverageAmount,
            }
          : null,
        promoCodeError,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
