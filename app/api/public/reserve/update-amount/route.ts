import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Settings from '@/models/Settings'
import Promotion from '@/models/Promotion'
import ProtectionPlan from '@/models/ProtectionPlan'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { calculateCharges } from '@/lib/billing/calculate-charges'

const schema = z.object({
  leaseId: z.string(),
  signDate: z.string().optional(),
  promoCode: z.string().optional(),
  protectionPlanId: z.string().nullable().optional(),
  /** Payment instrument the prospect now wants to use. If it differs from the
   *  existing intent's `payment_method_types`, we cancel and recreate — Stripe
   *  doesn't let us swap that field on an existing intent. */
  paymentMethodType: z.enum(['card', 'ach']).optional(),
})

// POST /api/public/reserve/update-amount
// Recalculates due-today and updates the lease's Stripe PaymentIntent amount.
// Used by the public reserve flow when promo code or protection plan changes.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const { leaseId, signDate, promoCode, protectionPlanId, paymentMethodType } = parsed.data

    await connectDB()

    const lease = await Lease.findById(leaseId)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    if (lease.signedAt) return NextResponse.json({ success: false, error: 'Lease already signed' }, { status: 409 })

    const unit = await Unit.findById(lease.unitId).lean()
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })

    const settingsDoc = await Settings.findOne({}).lean()
    const settings = { ...DEFAULT_SETTINGS, ...(settingsDoc || {}) } as any

    const sd = signDate ? new Date(signDate) : new Date()

    let appliedPromotion: any = null
    if (promoCode && promoCode.trim().length > 0) {
      const code = promoCode.trim().toUpperCase()
      const promo: any = await Promotion.findOne({
        promoCode: { $regex: new RegExp(`^${code}$`, 'i') },
        status: 'active',
      }).lean()
      if (promo) {
        const now = sd
        const start = promo.startDate ? new Date(promo.startDate) : null
        const end = promo.noExpiration ? null : promo.endDate ? new Date(promo.endDate) : null
        const validWindow = (!start || now >= start) && (!end || now <= end)
        const validUnitType =
          promo.allUnitTypes ||
          !Array.isArray(promo.unitTypes) ||
          promo.unitTypes.length === 0 ||
          promo.unitTypes.includes((unit as any).type)
        if (validWindow && validUnitType) appliedPromotion = promo
      }
    }

    let appliedProtectionPlan: any = null
    if (protectionPlanId) {
      const plan: any = await ProtectionPlan.findById(protectionPlanId).lean()
      if (plan && plan.status === 'active') appliedProtectionPlan = plan
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

    const dueTotal = Math.max(50, breakdown.dueToday.total) // Stripe minimum 50 cents

    if (process.env.STRIPE_SECRET_KEY) {
      const { stripe } = await import('@/lib/stripe')
      const Tenant = (await import('@/models/Tenant')).default

      let intent: any = null

      // Try search API first (won't be indexed for very fresh PIs)
      try {
        const intents = await stripe.paymentIntents.search({
          query: `metadata['leaseId']:'${lease._id.toString()}' AND status:'requires_payment_method'`,
          limit: 1,
        })
        intent = intents.data[0] ?? null
      } catch { /* search may be unavailable, fall through to list */ }

      // Fallback: list by customer + filter
      if (!intent) {
        const tenant = await Tenant.findById(lease.tenantId)
        if (tenant?.stripeCustomerId) {
          const list = await stripe.paymentIntents.list({
            customer: tenant.stripeCustomerId,
            limit: 10,
          })
          intent = list.data.find(
            (pi) =>
              pi.metadata?.leaseId === lease._id.toString() &&
              (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation'),
          ) ?? null
        }
      }

      const desiredPmTypes = paymentMethodType === 'ach' ? ['us_bank_account'] : ['card']

      if (intent) {
        const currentTypes = intent.payment_method_types ?? []
        const typesMatch = currentTypes.length === desiredPmTypes.length
          && currentTypes.every((t: string) => desiredPmTypes.includes(t))

        if (!typesMatch && paymentMethodType) {
          // Stripe forbids mutating payment_method_types on a live intent —
          // cancel and create a fresh one in the requested mode.
          try { await stripe.paymentIntents.cancel(intent.id) } catch { /* already canceled / completed */ }
          const tenant = await Tenant.findById(lease.tenantId)
          const newIntent = await stripe.paymentIntents.create({
            amount: dueTotal,
            currency: 'usd',
            customer: tenant?.stripeCustomerId,
            payment_method_types: desiredPmTypes,
            setup_future_usage: 'off_session',
            ...(paymentMethodType === 'ach'
              ? {
                  payment_method_options: {
                    us_bank_account: { verification_method: 'automatic' },
                  },
                }
              : {}),
            metadata: {
              tenantId: lease.tenantId.toString(),
              leaseId: lease._id.toString(),
              type: 'move_in',
              paymentMethodType,
            },
          })
          return NextResponse.json({
            success: true,
            data: {
              clientSecret: newIntent.client_secret,
              paymentIntentId: newIntent.id,
              amount: dueTotal,
              devMode: false,
            },
          })
        }

        if (intent.amount !== dueTotal) {
          intent = await stripe.paymentIntents.update(intent.id, { amount: dueTotal })
        }
        return NextResponse.json({
          success: true,
          data: {
            clientSecret: intent.client_secret,
            paymentIntentId: intent.id,
            amount: dueTotal,
            devMode: false,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: null,
        paymentIntentId: null,
        amount: dueTotal,
        devMode: !process.env.STRIPE_SECRET_KEY,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
