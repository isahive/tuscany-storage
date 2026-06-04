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
import { nextBalanceAfter } from '@/lib/paymentBalance'
import { sendTemplatedNotification } from '@/lib/sendNotification'

const schema = z.object({
  leaseId: z.string(),
  paymentIntentId: z.string().optional(),
  /** How the prospect paid. ACH stays in `processing` for 3-5 days — we accept
   *  that and let the Stripe webhook reconcile when clearing completes. */
  paymentMethodType: z.enum(['card', 'ach']).default('card'),
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
      leaseId, paymentIntentId, paymentMethodType, signatureData, signatureType, saveCard,
      billingAddress, promoCode, protectionPlanId,
    } = parsed.data

    await connectDB()

    const lease = await Lease.findById(leaseId)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })

    const unit = await Unit.findById(lease.unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })

    // ─── 1. Validate Stripe intent (or generate dev id) ────────────────────────
    // Card payments resolve to status='succeeded' immediately after
    // confirmCardPayment. ACH payments resolve to status='processing' and only
    // flip to 'succeeded' 3-5 business days later via the webhook. We accept
    // both here and tag the resulting ledger rows accordingly — the webhook
    // reconciles ACH on clearing (status flip + balance decrement).
    let confirmedIntentId = paymentIntentId
    let paymentStatus: 'succeeded' | 'pending' = paymentMethodType === 'ach' ? 'pending' : 'succeeded'

    if (process.env.STRIPE_SECRET_KEY) {
      if (!paymentIntentId) {
        return NextResponse.json({ success: false, error: 'Payment confirmation required' }, { status: 400 })
      }
      const { stripe } = await import('@/lib/stripe')
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (intent.status === 'succeeded') {
        paymentStatus = 'succeeded'
      } else if (intent.status === 'processing' && paymentMethodType === 'ach') {
        paymentStatus = 'pending'
      } else {
        return NextResponse.json({ success: false, error: 'Payment not confirmed. Please try again.' }, { status: 402 })
      }

      // If user opted out of saving the instrument, detach it.
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
    // Two-row pattern (Storable parity):
    //   - One direction='charge' row per line item (deposit, rent, protection,
    //     tax…) — these are what was invoiced.
    //   - ONE direction='payment' row equal to the total — what the customer
    //     actually paid via Stripe. Links back via `appliedToItemIds`.
    // balanceDelta nets the two to zero so the new tenant's balance ends at 0.
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    interface LineSpec {
      amount: number
      type: 'rent' | 'deposit' | 'prorated' | 'other'
      description: string
      periodStart: Date
      periodEnd: Date
    }
    const lines: LineSpec[] = []
    for (const line of breakdown.dueToday.lines) {
      if (line.amount === 0) continue
      let type: LineSpec['type'] = 'other'
      if (line.type === 'rent') type = line.label.toLowerCase().includes('prorat') ? 'prorated' : 'rent'
      else if (line.type === 'deposit') type = 'deposit'
      else type = 'other'
      lines.push({
        amount: line.amount,
        type,
        description: line.label,
        periodStart: line.periodStart ?? periodStart,
        periodEnd: line.periodEnd ?? periodEnd,
      })
    }
    if (lines.length === 0) {
      const price = (unit as any).price
      lines.push(
        { amount: price, type: 'deposit', description: 'Deposit', periodStart, periodEnd },
        { amount: price, type: 'rent', description: 'Monthly Rent', periodStart, periodEnd },
      )
    }

    // Charge rows track money the tenant owes. For card payments we mark
    // them succeeded immediately (the money already moved). For ACH the money
    // is still in transit, so the charges stay pending and the webhook flips
    // them when payment_intent.succeeded fires (3-5 business days later).
    const chargeRowStatus = paymentStatus === 'succeeded' ? 'succeeded' : 'pending'

    // ── Create the charges sequentially so balanceAfter walks correctly ──
    const createdCharges: any[] = []
    for (const l of lines) {
      const balanceAfter = await nextBalanceAfter(Payment, lease.tenantId, {
        direction: 'charge',
        status: chargeRowStatus,
        amount: l.amount,
      })
      const c = await Payment.create({
        tenantId: lease.tenantId,
        leaseId: lease._id,
        unitId: lease.unitId,
        amount: l.amount,
        currency: 'usd',
        type: l.type,
        status: chargeRowStatus,
        direction: 'charge',
        balanceAfter,
        description: l.description,
        periodStart: l.periodStart,
        periodEnd: l.periodEnd,
        attemptCount: 1,
      })
      createdCharges.push(c)
    }

    // ── Create the matching payment row that settled (or will settle) the move-in total ──
    const totalCents = lines.reduce((s, l) => s + l.amount, 0)
    const paymentBalanceAfter = await nextBalanceAfter(Payment, lease.tenantId, {
      direction: 'payment',
      status: paymentStatus,
      amount: totalCents,
    })
    const paymentMethodLabel = paymentMethodType === 'ach' ? 'ACH' : 'Credit Card'
    const moveInDescription = paymentStatus === 'pending'
      ? `Move-in payment — ${paymentMethodLabel} (Pending)`
      : `Move-in payment — ${paymentMethodLabel}`
    await Payment.create({
      tenantId: lease.tenantId,
      leaseId: lease._id,
      unitId: lease.unitId,
      amount: totalCents,
      currency: 'usd',
      type: 'rent',
      status: paymentStatus,
      direction: 'payment',
      balanceAfter: paymentBalanceAfter,
      stripePaymentIntentId: confirmedIntentId!,
      description: moveInDescription,
      appliedToItemIds: createdCharges.map((c) => c._id),
      attemptCount: 1,
      lastAttemptAt: now,
    })

    // Sync the denormalized tenant.balance so the dashboard reads correctly
    // without waiting for the next ledger walk. For card → 0 (money moved).
    // For ACH pending → 0 also (balanceAfter from nextBalanceAfter), but if
    // the ACH later fails, the stripe webhook restores the charge as a debt.
    await Tenant.findByIdAndUpdate(lease.tenantId, { balance: paymentBalanceAfter })

    // ─── 7. Increment counts ───────────────────────────────────────────────────
    if (appliedPromotion) {
      await Promotion.updateOne(
        { _id: appliedPromotion._id },
        {
          $inc: { appliedCount: 1 },
          // Stamp firstAppliedAt only once — Storable uses it to start the
          // "locked fields" window in the admin edit form.
          $setOnInsert: {},
          ...(!appliedPromotion.firstAppliedAt ? { $set: { firstAppliedAt: new Date() } } : {}),
        },
      )
      const TenantAlteration = (await import('@/models/TenantAlteration')).default
      await TenantAlteration.create({
        tenantId: lease.tenantId,
        leaseId: lease._id,
        unitId: lease.unitId,
        unitNumber: (unit as any).unitNumber,
        action: 'promotion_added',
        payload: {
          promotionId: String(appliedPromotion._id),
          promotionName: appliedPromotion.name,
          method: appliedPromotion.method,
          discountType: appliedPromotion.discountType,
          discountValue: appliedPromotion.discountValue,
        },
        createdBy: 'online_rental',
      })
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
        templateName: 'Automatic Payment Receipt',
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
