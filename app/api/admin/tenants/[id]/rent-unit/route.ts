import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { generateGateCode } from '@/lib/utils'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Settings from '@/models/Settings'
import Promotion from '@/models/Promotion'
import ProtectionPlan from '@/models/ProtectionPlan'
import Product from '@/models/Product'
import AccessLog from '@/models/AccessLog'
import { syncTenantToPdkSafe } from '@/lib/pdkSync'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  unitId: z.string().min(1),
  moveInDate: z.string(),                  // ISO date
  billingStartDate: z.string(),            // ISO — first full billing cycle start
  planMonthlyRate: z.number().int().min(0),// cents
  promotionId: z.string().nullable().optional(),
  protectionPlanId: z.string().nullable().optional(),
  chargeDeposit: z.boolean(),
  depositAmount: z.number().int().min(0),
  depositPreviouslyPaid: z.boolean(),
  chargeSetupFee: z.boolean(),
  exemptFromRateManagement: z.boolean(),
  prorationModel: z.enum([
    'none',
    'custom',
    'first_month_full_prorate_now',
    'first_month_full_then_prorate',
    'prorate_first_month',
    'prorate_both',
  ]),
  /** Cents — used only when prorationModel === 'custom'. */
  customProratedRent: z.number().int().min(0).optional(),
  /** Cents — used only when prorationModel === 'custom' and a protection plan is selected. */
  customProratedProtection: z.number().int().min(0).optional(),
  addedFees: z.array(z.object({ feeId: z.string(), amount: z.number().int().min(0) })).default([]),
  addedProducts: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).default(1) })).default([]),
  taxRate: z.number().min(0).max(100),
  agreementEmail: z.boolean().default(false),
  agreementText: z.boolean().default(false),
})

/** Returns the positive discount amount the promo applies to a single rent line. */
function promoDiscountAmount(
  rentCents: number,
  promo: { discountType: 'percentage' | 'fixed'; discountValue: number } | null,
): number {
  if (!promo) return 0
  if (promo.discountType === 'percentage') {
    return Math.max(0, Math.round(rentCents * (promo.discountValue / 100)))
  }
  return Math.min(promo.discountValue, rentCents)
}

function lastDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

/** Parses a YYYY-MM-DD or ISO date string into a UTC-anchored Date so that
 *  subsequent getUTC* arithmetic returns the calendar day the admin picked,
 *  independent of the server's local timezone. */
function parseCalendarDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00.000Z`)
  }
  return new Date(s)
}

/**
 * POST /api/admin/tenants/[id]/rent-unit
 *
 * Replaces /api/admin/move-in for admin rent-a-unit flow. Creates a Lease, marks the
 * Unit occupied, generates a gate code, and writes the full chain of Payment rows
 * (today's total due, prorated second month, ongoing rent is handled by cron).
 *
 * Only "first_month_full_then_prorate" implements the prorated-second-month math
 * matching the live admin. Other models record just the immediate "today" charges.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id: tenantId } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const [tenant, unit, settings] = await Promise.all([
      Tenant.findById(tenantId),
      Unit.findById(parsed.data.unitId),
      Settings.findOne({}),
    ])

    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'available') {
      return NextResponse.json({ success: false, error: 'Unit is not available' }, { status: 400 })
    }

    const promotion = parsed.data.promotionId
      ? await Promotion.findById(parsed.data.promotionId)
      : null
    const protection = parsed.data.protectionPlanId
      ? await ProtectionPlan.findById(parsed.data.protectionPlanId)
      : null

    const moveInDate = parseCalendarDate(parsed.data.moveInDate)
    const billingStart = parseCalendarDate(parsed.data.billingStartDate)
    const monthlyRate = parsed.data.planMonthlyRate
    const protectionMonthly = protection?.monthlyPrice ?? 0
    const setupFee = parsed.data.chargeSetupFee ? (settings?.setupFeeAmount ?? 0) : 0
    const taxRate = parsed.data.taxRate
    const billingDay = billingStart.getUTCDate() <= 28 ? billingStart.getUTCDate() : 1

    // Promo applies only to the first full-month rent line — stored as a separate
    // negative payment row below. Lease.monthlyRate stays at the un-discounted rate
    // so recurring billing keeps charging the full price after the promo ends.
    const promoDiscount = promoDiscountAmount(
      monthlyRate,
      promotion ? { discountType: promotion.discountType, discountValue: promotion.discountValue } : null,
    )

    // ── Create the lease ──
    const lease = await Lease.create({
      tenantId: tenant._id,
      unitId: unit._id,
      startDate: moveInDate,
      monthlyRate: monthlyRate,
      deposit: parsed.data.chargeDeposit ? parsed.data.depositAmount : 0,
      proratedFirstMonth: 0, // filled below for "prorate_first_month" model
      billingDay,
      status: 'active',
      appliedPromotionId: promotion?._id,
      protectionPlanId: protection?._id,
      exemptFromRateManagement: parsed.data.exemptFromRateManagement,
      prorationModel: parsed.data.prorationModel,
      taxRate,
      setupFee,
      agreementNotify: { email: parsed.data.agreementEmail, text: parsed.data.agreementText },
    })

    await Unit.findByIdAndUpdate(unit._id, {
      status: 'occupied',
      currentTenantId: tenant._id,
      currentLeaseId: lease._id,
    })

    // Storable parity — bump promotion counters + audit log when an admin
    // attaches a promo during the rent-unit flow. The CRUD lock checks
    // depend on these counters being current.
    if (promotion) {
      await Promotion.updateOne(
        { _id: promotion._id },
        {
          $inc: { appliedCount: 1 },
          ...(!promotion.firstAppliedAt ? { $set: { firstAppliedAt: new Date() } } : {}),
        },
      )
      const TenantAlteration = (await import('@/models/TenantAlteration')).default
      await TenantAlteration.create({
        tenantId: tenant._id,
        leaseId: lease._id,
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        action: 'promotion_added',
        payload: {
          promotionId: String(promotion._id),
          promotionName: promotion.name,
          method: promotion.method,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        },
        createdBy: session.user.name ?? session.user.email ?? 'admin',
      })
    }

    if (!tenant.gateCode) {
      tenant.gateCode = generateGateCode()
      tenant.status = 'active'
      await tenant.save()
      await AccessLog.create({
        tenantId: tenant._id,
        unitId: unit._id,
        eventType: 'code_changed',
        gateId: 'entrance',
        source: 'admin',
        notes: 'Gate code assigned during rent-unit flow',
      })
      await syncTenantToPdkSafe(tenant._id as any)
    }

    // ── Build line items ──
    const today = moveInDate
    const lines: Array<{
      type: 'rent' | 'prorated' | 'deposit' | 'other'
      amount: number
      description: string
      dueDate: Date
      status: 'pending' | 'succeeded'
      taxRate?: number
      periodStart?: Date
      periodEnd?: Date
    }> = []

    if (parsed.data.prorationModel === 'first_month_full_then_prorate') {
      // First full month rent + protection due today
      const firstMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate() - 1)
      lines.push({
        type: 'rent',
        amount: monthlyRate,
        description: 'Rent',
        dueDate: today,
        status: 'pending',
        periodStart: today,
        periodEnd: firstMonthEnd,
      })
      if (protection) {
        lines.push({
          type: 'other',
          amount: protectionMonthly,
          description: `${protection.name} (Tenant Protection)`,
          dueDate: today,
          status: 'pending',
          periodStart: today,
          periodEnd: firstMonthEnd,
        })
      }

      // Prorated second month: from firstMonthEnd+1 up to billing-cycle anchor's last day
      const secondMonthStart = new Date(firstMonthEnd)
      secondMonthStart.setUTCDate(secondMonthStart.getUTCDate() + 1)
      const secondMonthAnchor = new Date(Date.UTC(billingStart.getUTCFullYear(), billingStart.getUTCMonth() + 1, 1))
      // Days remaining = secondMonthAnchor - 1 - secondMonthStart, inclusive
      const daysInSecondMonth = new Date(Date.UTC(secondMonthStart.getUTCFullYear(), secondMonthStart.getUTCMonth() + 1, 0)).getUTCDate()
      const remainingDays = Math.max(
        0,
        Math.round((secondMonthAnchor.getTime() - secondMonthStart.getTime()) / (1000 * 60 * 60 * 24)),
      )
      if (remainingDays > 0 && remainingDays < daysInSecondMonth) {
        const proratedRent = Math.round((monthlyRate / daysInSecondMonth) * remainingDays)
        lines.push({
          type: 'prorated',
          amount: proratedRent,
          description: `Prorated rent (${remainingDays} days)`,
          dueDate: billingStart,
          status: 'pending',
          periodStart: secondMonthStart,
          periodEnd: new Date(secondMonthAnchor.getTime() - 1),
        })
        if (protection) {
          const proratedProtection = Math.round((protectionMonthly / daysInSecondMonth) * remainingDays)
          lines.push({
            type: 'other',
            amount: proratedProtection,
            description: `Prorated ${protection.name}`,
            dueDate: billingStart,
            status: 'pending',
            periodStart: secondMonthStart,
            periodEnd: new Date(secondMonthAnchor.getTime() - 1),
          })
        }
      }
      lease.proratedFirstMonth = 0
    } else if (parsed.data.prorationModel === 'prorate_first_month') {
      const daysInMonth = lastDayOfMonth(today).getUTCDate()
      const remainingDays = daysInMonth - today.getUTCDate() + 1
      const proratedRent = Math.round((monthlyRate / daysInMonth) * remainingDays)
      lines.push({
        type: 'prorated',
        amount: proratedRent,
        description: `Prorated rent (${remainingDays} days)`,
        dueDate: today,
        status: 'pending',
        periodStart: today,
        periodEnd: lastDayOfMonth(today),
      })
      if (protection) {
        const proratedProtection = Math.round((protectionMonthly / daysInMonth) * remainingDays)
        lines.push({
          type: 'other',
          amount: proratedProtection,
          description: `Prorated ${protection.name}`,
          dueDate: today,
          status: 'pending',
          periodStart: today,
          periodEnd: lastDayOfMonth(today),
        })
      }
      lease.proratedFirstMonth = proratedRent
    } else if (parsed.data.prorationModel === 'first_month_full_prorate_now') {
      // Same as first_month_full_then_prorate, but the prorated second-month
      // chunk is due TODAY instead of at billingStart.
      const firstMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate() - 1)
      lines.push({
        type: 'rent',
        amount: monthlyRate,
        description: 'Rent',
        dueDate: today,
        status: 'pending',
        periodStart: today,
        periodEnd: firstMonthEnd,
      })
      if (protection) {
        lines.push({
          type: 'other',
          amount: protectionMonthly,
          description: `${protection.name} (Tenant Protection)`,
          dueDate: today,
          status: 'pending',
          periodStart: today,
          periodEnd: firstMonthEnd,
        })
      }

      const secondMonthStart = new Date(firstMonthEnd)
      secondMonthStart.setUTCDate(secondMonthStart.getUTCDate() + 1)
      const secondMonthAnchor = new Date(Date.UTC(billingStart.getUTCFullYear(), billingStart.getUTCMonth() + 1, 1))
      const daysInSecondMonth = new Date(Date.UTC(secondMonthStart.getUTCFullYear(), secondMonthStart.getUTCMonth() + 1, 0)).getUTCDate()
      const remainingDays = Math.max(
        0,
        Math.round((secondMonthAnchor.getTime() - secondMonthStart.getTime()) / (1000 * 60 * 60 * 24)),
      )
      if (remainingDays > 0 && remainingDays < daysInSecondMonth) {
        const proratedRent = Math.round((monthlyRate / daysInSecondMonth) * remainingDays)
        lines.push({
          type: 'prorated',
          amount: proratedRent,
          description: `Prorated rent (${remainingDays} days)`,
          dueDate: today,
          status: 'pending',
          periodStart: secondMonthStart,
          periodEnd: new Date(secondMonthAnchor.getTime() - 1),
        })
        if (protection) {
          const proratedProtection = Math.round((protectionMonthly / daysInSecondMonth) * remainingDays)
          lines.push({
            type: 'other',
            amount: proratedProtection,
            description: `Prorated ${protection.name}`,
            dueDate: today,
            status: 'pending',
            periodStart: secondMonthStart,
            periodEnd: new Date(secondMonthAnchor.getTime() - 1),
          })
        }
      }
    } else if (parsed.data.prorationModel === 'prorate_both') {
      // Prorate this month and bill now for the first billing cycle:
      // prorated partial period + full first billing cycle, both due today.
      const daysInMonth = lastDayOfMonth(today).getUTCDate()
      const partialDays = daysInMonth - today.getUTCDate() + 1
      const proratedRent = Math.round((monthlyRate / daysInMonth) * partialDays)
      lines.push({
        type: 'prorated',
        amount: proratedRent,
        description: `Prorated rent (${partialDays} days)`,
        dueDate: today,
        status: 'pending',
        periodStart: today,
        periodEnd: lastDayOfMonth(today),
      })
      if (protection) {
        const proratedProtection = Math.round((protectionMonthly / daysInMonth) * partialDays)
        lines.push({
          type: 'other',
          amount: proratedProtection,
          description: `Prorated ${protection.name}`,
          dueDate: today,
          status: 'pending',
          periodStart: today,
          periodEnd: lastDayOfMonth(today),
        })
      }
      // First full billing cycle (the month starting at billingStart)
      const cycleEnd = new Date(Date.UTC(billingStart.getUTCFullYear(), billingStart.getUTCMonth() + 1, 0))
      lines.push({
        type: 'rent',
        amount: monthlyRate,
        description: 'First billing cycle rent',
        dueDate: today,
        status: 'pending',
        periodStart: billingStart,
        periodEnd: cycleEnd,
      })
      if (protection) {
        lines.push({
          type: 'other',
          amount: protectionMonthly,
          description: `${protection.name} (Tenant Protection)`,
          dueDate: today,
          status: 'pending',
          periodStart: billingStart,
          periodEnd: cycleEnd,
        })
      }
      lease.proratedFirstMonth = proratedRent
    } else if (parsed.data.prorationModel === 'custom') {
      // Admin types both the prorated rent and the prorated protection fee by hand.
      lines.push({
        type: 'prorated',
        amount: parsed.data.customProratedRent ?? monthlyRate,
        description: 'Prorated amount',
        dueDate: today,
        status: 'pending',
        periodStart: today,
      })
      if (protection) {
        lines.push({
          type: 'other',
          amount: parsed.data.customProratedProtection ?? protectionMonthly,
          description: `Prorated ${protection.name}`,
          dueDate: today,
          status: 'pending',
        })
      }
    } else {
      // 'none' — bill one full month at move-in
      const firstMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate() - 1)
      lines.push({
        type: 'rent',
        amount: monthlyRate,
        description: 'Rent',
        dueDate: today,
        status: 'pending',
        periodStart: today,
        periodEnd: firstMonthEnd,
      })
      if (protection) {
        lines.push({
          type: 'other',
          amount: protectionMonthly,
          description: `${protection.name} (Tenant Protection)`,
          dueDate: today,
          status: 'pending',
          periodStart: today,
          periodEnd: firstMonthEnd,
        })
      }
    }

    // Promo applies only to the first full-month rent line and only for models
    // that actually emit a full-month rent (i.e. not prorate_first_month/custom).
    const promoAppliesToModel =
      parsed.data.prorationModel !== 'prorate_first_month' &&
      parsed.data.prorationModel !== 'custom'
    if (promotion && promoDiscount > 0 && promoAppliesToModel) {
      lines.push({
        type: 'other',
        amount: -promoDiscount,
        description: `Rent Promotion Amount (${promotion.name})`,
        dueDate: today,
        status: 'pending',
      })
    }

    if (parsed.data.chargeDeposit && parsed.data.depositAmount > 0) {
      lines.push({
        type: 'deposit',
        amount: parsed.data.depositAmount,
        description: parsed.data.depositPreviouslyPaid ? 'Deposit (previously paid)' : 'Deposit',
        dueDate: today,
        status: parsed.data.depositPreviouslyPaid ? 'succeeded' : 'pending',
      })
    }

    if (setupFee > 0) {
      lines.push({
        type: 'other',
        amount: setupFee,
        description: settings?.setupFeeName ?? 'Setup Fee',
        dueDate: today,
        status: 'pending',
      })
    }

    // Fees (admin-defined from Settings.customFees)
    for (const f of parsed.data.addedFees) {
      const fee = settings?.customFees?.find((x: any) => x.id === f.feeId)
      lines.push({
        type: 'other',
        amount: f.amount,
        description: fee?.name ?? 'Fee',
        dueDate: today,
        status: 'pending',
        taxRate,
      })
    }

    // Products
    for (const p of parsed.data.addedProducts) {
      const product = await Product.findById(p.productId)
      if (!product) continue
      lines.push({
        type: 'other',
        amount: product.price * p.quantity,
        description: `${product.name}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`,
        dueDate: today,
        status: 'pending',
        taxRate: product.taxRate ?? taxRate,
      })
    }

    // Storable parity — if the unit was reserved and the customer prepaid a
    // reservation fee, the deposit is credited on the first rental invoice.
    // We record it as a negative line so the running balance reflects the
    // refund-as-credit and the customer sees the offset on their statement.
    if ((unit.reservationFeePaid ?? 0) > 0) {
      lines.push({
        type: 'other',
        amount: -(unit.reservationFeePaid as number),
        description: 'Reservation Deposit credit',
        dueDate: today,
        status: 'succeeded',
      })
      // Clear the unit-side flags so a subsequent cancel doesn't try to
      // refund again — the fee has now been "consumed" as a credit.
      unit.reservationFeePaid = undefined
      unit.reservationFeePaidAt = undefined
      // Keep reservationPaymentIntentId for the audit trail.
    }

    // ── Persist payment rows ──
    await Payment.insertMany(
      lines.map((l) => ({
        tenantId: tenant._id,
        leaseId: lease._id,
        unitId: unit._id,
        amount: l.amount,
        currency: 'usd',
        type: l.type,
        status: l.status,
        description: l.description,
        dueDate: l.dueDate,
        periodStart: l.periodStart,
        periodEnd: l.periodEnd,
        taxRate: l.taxRate ?? 0,
        attemptCount: 0,
        createdBy: session.user.id,
      })),
    )

    // ── Update tenant balance with the pending total ──
    const pendingTotal = lines
      .filter((l) => l.status === 'pending')
      .reduce((sum, l) => sum + l.amount, 0)
    tenant.balance = (tenant.balance ?? 0) + pendingTotal
    await tenant.save()
    await lease.save()

    if (promotion) {
      promotion.appliedCount = (promotion.appliedCount ?? 0) + 1
      await promotion.save()
    }
    if (protection) {
      protection.appliedCount = (protection.appliedCount ?? 0) + 1
      await protection.save()
    }

    return NextResponse.json({
      success: true,
      data: {
        leaseId: String(lease._id),
        unitId: String(unit._id),
        balance: tenant.balance,
        lineCount: lines.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
