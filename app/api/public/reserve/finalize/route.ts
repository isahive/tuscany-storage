import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import Settings from '@/models/Settings'
import Promotion from '@/models/Promotion'
import ProtectionPlan from '@/models/ProtectionPlan'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { calculateCharges } from '@/lib/billing/calculate-charges'
import { sendTemplatedNotification } from '@/lib/sendNotification'

const schema = z.object({
  leaseId: z.string(),
  paymentIntentId: z.string().optional(),
  signatureData: z.string().min(1),
  signatureType: z.enum(['drawn', 'typed']),
  saveCard: z.boolean().optional(),
  billingAddress: z
    .object({
      line1: z.string().optional().default(''),
      city: z.string().optional().default(''),
      state: z.string().optional().default(''),
      zip: z.string().optional().default(''),
      country: z.string().optional().default(''),
    })
    .optional(),
  promoCode: z.string().optional(),
  protectionPlanId: z.string().nullable().optional(),
})

// POST /api/public/reserve/finalize
// Combines payment confirmation + signature + unit activation in one transaction.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const {
      leaseId, paymentIntentId, signatureData, signatureType, saveCard,
      billingAddress, promoCode, protectionPlanId,
    } = parsed.data

    await connectDB()

    const lease = await Lease.findById(leaseId)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })

    const unit = await Unit.findById(lease.unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })

    // ─── 1. Validate Stripe intent (or generate dev id) ────────────────────────
    let confirmedIntentId = paymentIntentId
    if (process.env.STRIPE_SECRET_KEY) {
      if (!paymentIntentId) {
        return NextResponse.json({ success: false, error: 'Payment confirmation required' }, { status: 400 })
      }
      const { stripe } = await import('@/lib/stripe')
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (intent.status !== 'succeeded') {
        return NextResponse.json({ success: false, error: 'Payment not confirmed. Please try again.' }, { status: 402 })
      }

      // If user opted out of saving card, detach the payment method
      if (saveCard === false && intent.payment_method && typeof intent.payment_method === 'string') {
        try { await stripe.paymentMethods.detach(intent.payment_method) } catch { /* ignore */ }
      }
    } else {
      confirmedIntentId = `pi_dev_${crypto.randomBytes(8).toString('hex')}`
    }

    // ─── 2. Recalculate charges (server-authoritative) ─────────────────────────
    const settingsDoc = await Settings.findOne({}).lean()
    const settings = { ...DEFAULT_SETTINGS, ...(settingsDoc || {}) } as any

    let appliedPromotion: any = null
    if (promoCode && promoCode.trim().length > 0) {
      const code = promoCode.trim().toUpperCase()
      const promo: any = await Promotion.findOne({
        promoCode: { $regex: new RegExp(`^${code}$`, 'i') },
        status: 'active',
      }).lean()
      if (promo) {
        const now = new Date()
        const start = promo.startDate ? new Date(promo.startDate) : null
        const end = promo.noExpiration ? null : promo.endDate ? new Date(promo.endDate) : null
        const validWindow = (!start || now >= start) && (!end || now <= end)
        const validUnitType =
          promo.allUnitTypes ||
          !Array.isArray(promo.unitTypes) ||
          promo.unitTypes.length === 0 ||
          promo.unitTypes.includes((unit as any).type)
        if (validWindow && validUnitType) appliedPromotion = promo
        else console.warn(`[finalize] Promo ${code} not applied (invalid window or unit type)`)
      } else {
        console.warn(`[finalize] Promo ${code} not found`)
      }
    }

    let appliedProtectionPlan: any = null
    if (protectionPlanId) {
      const plan: any = await ProtectionPlan.findById(protectionPlanId).lean()
      if (plan && plan.status === 'active') appliedProtectionPlan = plan
    }

    const sd = new Date()
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

    // ─── 3. Sign lease & link plan/promo ───────────────────────────────────────
    lease.signatureData = signatureData
    lease.signatureType = signatureType
    lease.signedAt = new Date()
    if (appliedPromotion) lease.appliedPromotionId = appliedPromotion._id
    if (appliedProtectionPlan) lease.protectionPlanId = appliedProtectionPlan._id
    await lease.save()

    // ─── 4. Mark unit occupied ─────────────────────────────────────────────────
    unit.status = 'occupied'
    await unit.save()

    // ─── 5. Save billing address on tenant ─────────────────────────────────────
    if (billingAddress && billingAddress.line1) {
      await Tenant.findByIdAndUpdate(lease.tenantId, {
        billingAddress: {
          line1: billingAddress.line1,
          city: billingAddress.city,
          state: billingAddress.state,
          zip: billingAddress.zip,
          country: billingAddress.country || 'US',
        },
      })
    }

    // ─── 6. Create Payment records from breakdown ──────────────────────────────
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const paymentDocs: Array<Record<string, unknown>> = []
    let suffixIdx = 0
    for (const line of breakdown.dueToday.lines) {
      if (line.amount === 0) continue
      let type: 'rent' | 'deposit' | 'prorated' | 'other' = 'other'
      if (line.type === 'rent') type = line.label.toLowerCase().includes('prorat') ? 'prorated' : 'rent'
      else if (line.type === 'deposit') type = 'deposit'
      else type = 'other'

      paymentDocs.push({
        tenantId: lease.tenantId,
        leaseId: lease._id,
        unitId: lease.unitId,
        stripePaymentIntentId: suffixIdx === 0 ? confirmedIntentId! : `${confirmedIntentId!}_${suffixIdx}`,
        amount: line.amount,
        currency: 'usd',
        type,
        status: 'succeeded',
        periodStart: line.periodStart ?? periodStart,
        periodEnd: line.periodEnd ?? periodEnd,
        attemptCount: 1,
      })
      suffixIdx += 1
    }

    if (paymentDocs.length === 0) {
      // Fallback: simple deposit + rent
      paymentDocs.push(
        {
          tenantId: lease.tenantId, leaseId: lease._id, unitId: lease.unitId,
          stripePaymentIntentId: confirmedIntentId!, amount: (unit as any).price,
          currency: 'usd', type: 'deposit', status: 'succeeded', periodStart, periodEnd, attemptCount: 1,
        },
        {
          tenantId: lease.tenantId, leaseId: lease._id, unitId: lease.unitId,
          stripePaymentIntentId: `${confirmedIntentId!}_rent`, amount: (unit as any).price,
          currency: 'usd', type: 'rent', status: 'succeeded', periodStart, periodEnd, attemptCount: 1,
        },
      )
    }

    await Promise.all(paymentDocs.map((doc) => Payment.create(doc)))

    // ─── 7. Increment counts ───────────────────────────────────────────────────
    if (appliedPromotion) {
      await Promotion.findByIdAndUpdate(appliedPromotion._id, { $inc: { appliedCount: 1 } })
    }
    if (appliedProtectionPlan) {
      await ProtectionPlan.findByIdAndUpdate(appliedProtectionPlan._id, { $inc: { appliedCount: 1 } })
    }

    // ─── 8. Welcome notifications (email + SMS) ────────────────────────────────
    const tenant = await Tenant.findById(lease.tenantId)
    if (tenant) {
      const totalDue = breakdown.dueToday.lines.reduce((s, l) => s + l.amount, 0)
      await sendTemplatedNotification({
        templateName: 'Rental Instructions',
        notificationType: 'move_in_confirmation',
        tenant,
        unitNumber: unit.unitNumber,
        monthlyRate: unit.price,
      })
      await sendTemplatedNotification({
        templateName: 'Payment Receipt',
        notificationType: 'payment_confirmation',
        tenant,
        unitNumber: unit.unitNumber,
        paymentAmount: totalDue,
        paymentDate: new Date(),
        balance: 0,
      })
    }

    return NextResponse.json({ success: true, data: { leaseId: lease._id.toString() } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
