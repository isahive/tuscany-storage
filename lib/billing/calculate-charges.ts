export interface CalculateChargesInput {
  unit: { _id: string; size: string; type: string; price: number /* cents */ }
  signDate: Date
  settings: {
    billingCycleAnchor: 'first_of_month' | 'signup_day' | 'custom_day'
    billingCycleCustomDay: number
    prorationModel: 'none' | 'prorate_first_month' | 'first_month_full_then_prorate' | 'prorate_both'
    prorationDaysBasis: 'actual_days_in_month' | 'thirty_day_month'
    taxRate: number
  }
  promotion?: {
    _id: string
    name: string
    description: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    durationCycles: number
    noExpiration: boolean
    beginsImmediately: boolean
    beginsAfterCycles: number
  } | null
  protectionPlan?: {
    _id: string
    name: string
    monthlyPrice: number /* cents */
  } | null
  depositAmount: number /* cents */
}

export interface ChargeLine {
  label: string
  amount: number
  type: 'rent' | 'promotion' | 'protection' | 'deposit' | 'tax' | 'fee'
  description?: string
  periodStart?: Date
  periodEnd?: Date
}

export interface ChargeBreakdown {
  dueToday: { lines: ChargeLine[]; total: number }
  futureCharge: { dueDate: Date; lines: ChargeLine[]; total: number } | null
  recurring: {
    startDate: Date
    lines: ChargeLine[]
    total: number
    promoNote?: string
    promoEndsAfter?: { date: Date; cycles: number; postPromoTotal: number }
    promoStartsAt?: { date: Date; cycles: number }
  }
  appliedPromotion: {
    id: string
    name: string
    description: string
    effectiveCycles: { start: number; end: number | null }
  } | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth() + months, d.getDate())
  return next
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
  return next
}

function daysInMonth(date: Date, basis: 'actual_days_in_month' | 'thirty_day_month'): number {
  if (basis === 'thirty_day_month') return 30
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function nextAnchorDate(
  signDate: Date,
  anchor: 'first_of_month' | 'signup_day' | 'custom_day',
  customDay: number,
): Date {
  const sd = startOfDay(signDate)
  if (anchor === 'first_of_month') {
    if (sd.getDate() === 1) return sd
    return new Date(sd.getFullYear(), sd.getMonth() + 1, 1)
  }
  if (anchor === 'signup_day') {
    return sd
  }
  // custom_day
  const day = Math.min(Math.max(1, customDay), 28)
  if (sd.getDate() === day) return sd
  if (sd.getDate() < day) return new Date(sd.getFullYear(), sd.getMonth(), day)
  return new Date(sd.getFullYear(), sd.getMonth() + 1, day)
}

function proratedAmount(monthly: number, days: number, daysInMo: number): number {
  if (daysInMo <= 0) return 0
  return Math.round((monthly * days) / daysInMo)
}

function daysInPartialPeriod(signDate: Date, anchorDate: Date): number {
  const sd = startOfDay(signDate).getTime()
  const ad = startOfDay(anchorDate).getTime()
  const delta = Math.round((ad - sd) / MS_PER_DAY)
  return delta + 1
}

function applyPromotion(rentCents: number, promo: NonNullable<CalculateChargesInput['promotion']>): number {
  if (promo.discountType === 'percentage') {
    return Math.round((rentCents * promo.discountValue) / 100)
  }
  return Math.min(promo.discountValue, rentCents)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function calculateCharges(input: CalculateChargesInput): ChargeBreakdown {
  const { unit, signDate, settings, promotion, protectionPlan, depositAmount } = input
  const monthlyRent = unit.price
  const protectionPrice = protectionPlan?.monthlyPrice ?? 0
  const taxRate = settings.taxRate ?? 0
  const sd = startOfDay(signDate)

  const anchor = nextAnchorDate(sd, settings.billingCycleAnchor, settings.billingCycleCustomDay)
  const signIsAnchor = anchor.getTime() === sd.getTime()
  const needsProration =
    settings.prorationModel !== 'none' &&
    settings.billingCycleAnchor !== 'signup_day' &&
    !signIsAnchor

  const dueLines: ChargeLine[] = []
  const futureLines: ChargeLine[] = []
  const recurringLines: ChargeLine[] = []

  let recurringStart: Date

  if (!needsProration) {
    const periodStart = sd
    const periodEnd =
      settings.billingCycleAnchor === 'signup_day' ? addDays(addMonths(sd, 1), -1) : endOfMonth(sd)

    dueLines.push({
      label: 'First Month Rent',
      amount: monthlyRent,
      type: 'rent',
      periodStart,
      periodEnd,
    })

    if (promotion && promotion.beginsImmediately && promotion.beginsAfterCycles === 0) {
      const discount = applyPromotion(monthlyRent, promotion)
      if (discount > 0) {
        dueLines.push({
          label: `Promotion: ${promotion.name}`,
          amount: -discount,
          type: 'promotion',
          description: promotion.description,
        })
      }
    }

    if (protectionPrice > 0 && protectionPlan) {
      dueLines.push({
        label: `Protection Plan: ${protectionPlan.name}`,
        amount: protectionPrice,
        type: 'protection',
      })
    }

    recurringStart =
      settings.billingCycleAnchor === 'signup_day' ? addMonths(sd, 1) : addMonths(anchor, 1)
  } else if (settings.prorationModel === 'prorate_first_month') {
    const days = daysInPartialPeriod(sd, anchor)
    const dim = daysInMonth(sd, settings.prorationDaysBasis)
    const proratedRent = proratedAmount(monthlyRent, days, dim)

    dueLines.push({
      label: 'Prorated rent for partial period',
      amount: proratedRent,
      type: 'rent',
      description: `${days} days @ ${dim}-day month`,
      periodStart: sd,
      periodEnd: addDays(anchor, -1),
    })

    if (promotion && promotion.beginsImmediately && promotion.beginsAfterCycles === 0) {
      const discount = applyPromotion(proratedRent, promotion)
      if (discount > 0) {
        dueLines.push({
          label: `Promotion: ${promotion.name}`,
          amount: -discount,
          type: 'promotion',
          description: promotion.description,
        })
      }
    }

    if (protectionPrice > 0 && protectionPlan) {
      const proratedProtection = proratedAmount(protectionPrice, days, dim)
      dueLines.push({
        label: `Prorated Protection Plan: ${protectionPlan.name}`,
        amount: proratedProtection,
        type: 'protection',
        description: `${days} days @ ${dim}-day month`,
      })
    }

    recurringStart = anchor
  } else if (settings.prorationModel === 'first_month_full_then_prorate') {
    // Storable model: pay first FULL future month today, catch up on partial period at next anchor
    const fullPeriodStart = anchor
    const fullPeriodEnd = endOfMonth(anchor)

    dueLines.push({
      label: 'First Full Month Rent',
      amount: monthlyRent,
      type: 'rent',
      periodStart: fullPeriodStart,
      periodEnd: fullPeriodEnd,
    })

    if (promotion && promotion.beginsImmediately && promotion.beginsAfterCycles === 0) {
      const discount = applyPromotion(monthlyRent, promotion)
      if (discount > 0) {
        dueLines.push({
          label: `Promotion: ${promotion.name}`,
          amount: -discount,
          type: 'promotion',
          description: promotion.description,
        })
      }
    }

    if (protectionPrice > 0 && protectionPlan) {
      dueLines.push({
        label: `Protection Plan: ${protectionPlan.name}`,
        amount: protectionPrice,
        type: 'protection',
      })
    }

    const days = daysInPartialPeriod(sd, anchor)
    const dim = daysInMonth(anchor, settings.prorationDaysBasis)
    const proratedRent = proratedAmount(monthlyRent, days, dim)

    futureLines.push({
      label: 'Prorated rent for partial period',
      amount: proratedRent,
      type: 'rent',
      description: `${days} days @ ${dim}-day month`,
      periodStart: sd,
      periodEnd: addDays(anchor, -1),
    })

    if (protectionPrice > 0 && protectionPlan) {
      const proratedProtection = proratedAmount(protectionPrice, days, dim)
      futureLines.push({
        label: 'Prorated Protection Plan',
        amount: proratedProtection,
        type: 'protection',
        description: `${days} days @ ${dim}-day month`,
      })
    }

    recurringStart = addMonths(anchor, 1)
  } else {
    // prorate_both: prorated first partial + full second month all due today
    const days = daysInPartialPeriod(sd, anchor)
    const dim = daysInMonth(sd, settings.prorationDaysBasis)
    const proratedRent = proratedAmount(monthlyRent, days, dim)

    dueLines.push({
      label: 'Prorated rent for partial period',
      amount: proratedRent,
      type: 'rent',
      description: `${days} days @ ${dim}-day month`,
      periodStart: sd,
      periodEnd: addDays(anchor, -1),
    })

    dueLines.push({
      label: 'Second Month Rent',
      amount: monthlyRent,
      type: 'rent',
      periodStart: anchor,
      periodEnd: endOfMonth(anchor),
    })

    if (promotion && promotion.beginsImmediately && promotion.beginsAfterCycles === 0) {
      const discount = applyPromotion(proratedRent, promotion)
      if (discount > 0) {
        dueLines.push({
          label: `Promotion: ${promotion.name}`,
          amount: -discount,
          type: 'promotion',
          description: promotion.description,
        })
      }
    }

    if (protectionPrice > 0 && protectionPlan) {
      const proratedProtection = proratedAmount(protectionPrice, days, dim)
      dueLines.push({
        label: `Prorated Protection Plan: ${protectionPlan.name}`,
        amount: proratedProtection,
        type: 'protection',
        description: `${days} days @ ${dim}-day month`,
      })
      dueLines.push({
        label: `Protection Plan: ${protectionPlan.name}`,
        amount: protectionPrice,
        type: 'protection',
      })
    }

    recurringStart = addMonths(anchor, 1)
  }

  if (depositAmount > 0) {
    dueLines.push({
      label: 'Deposit',
      amount: depositAmount,
      type: 'deposit',
      description: 'Refundable security deposit',
    })
  }

  recurringLines.push({
    label: 'Monthly Rent',
    amount: monthlyRent,
    type: 'rent',
  })
  if (protectionPrice > 0 && protectionPlan) {
    recurringLines.push({
      label: `Protection Plan: ${protectionPlan.name}`,
      amount: protectionPrice,
      type: 'protection',
    })
  }

  // ---- Recurring promo handling (multi-cycle / delayed) ----
  let promoNote: string | undefined
  let promoEndsAfter: { date: Date; cycles: number; postPromoTotal: number } | undefined
  let promoStartsAt: { date: Date; cycles: number } | undefined
  let appliedPromotionOut: ChargeBreakdown['appliedPromotion'] = null

  // Determine whether the recurring snapshot should reflect the promo discount
  const hasRecurringPromoActive =
    !!promotion &&
    promotion.beginsImmediately &&
    promotion.beginsAfterCycles === 0 &&
    (promotion.noExpiration || promotion.durationCycles > 1)

  // Determine whether the promo is delayed (not yet active in cycle 1)
  const hasDelayedPromo =
    !!promotion && !promotion.beginsImmediately && promotion.beginsAfterCycles > 0

  if (promotion && hasRecurringPromoActive) {
    const discount = applyPromotion(monthlyRent, promotion)
    if (discount > 0) {
      recurringLines.push({
        label: `Promotion: ${promotion.name}`,
        amount: -discount,
        type: 'promotion',
        description: promotion.description,
      })
    }
    if (promotion.discountType === 'percentage') {
      promoNote = promotion.noExpiration
        ? `${promotion.discountValue}% off all rentals (no expiration)`
        : `${promotion.discountValue}% off for ${promotion.durationCycles} months`
    } else {
      const dollars = (promotion.discountValue / 100).toFixed(
        promotion.discountValue % 100 === 0 ? 0 : 2,
      )
      promoNote = promotion.noExpiration
        ? `$${dollars} off all rentals (no expiration)`
        : `$${dollars} off for ${promotion.durationCycles} cycles`
    }
    appliedPromotionOut = {
      id: promotion._id,
      name: promotion.name,
      description: promotion.description,
      effectiveCycles: {
        start: 1,
        end: promotion.noExpiration ? null : promotion.durationCycles,
      },
    }
  } else if (promotion && hasDelayedPromo) {
    promoStartsAt = {
      date: addMonths(recurringStart, promotion.beginsAfterCycles),
      cycles: promotion.beginsAfterCycles + 1,
    }
    if (promotion.discountType === 'percentage') {
      promoNote = `${promotion.discountValue}% off starting cycle ${promotion.beginsAfterCycles + 1}`
    } else {
      const dollars = (promotion.discountValue / 100).toFixed(
        promotion.discountValue % 100 === 0 ? 0 : 2,
      )
      promoNote = `$${dollars} off starting cycle ${promotion.beginsAfterCycles + 1}`
    }
    appliedPromotionOut = {
      id: promotion._id,
      name: promotion.name,
      description: promotion.description,
      effectiveCycles: {
        start: promotion.beginsAfterCycles + 1,
        end: promotion.noExpiration
          ? null
          : promotion.beginsAfterCycles + promotion.durationCycles,
      },
    }
  } else if (
    promotion &&
    promotion.beginsImmediately &&
    promotion.beginsAfterCycles === 0 &&
    !promotion.noExpiration &&
    promotion.durationCycles === 1
  ) {
    // v1 behavior: single-cycle promo applied only to dueToday
    appliedPromotionOut = {
      id: promotion._id,
      name: promotion.name,
      description: promotion.description,
      effectiveCycles: { start: 1, end: 1 },
    }
  }

  if (taxRate > 0) {
    const dueTaxBase = dueLines
      .filter((l) => l.type === 'rent' || l.type === 'promotion' || l.type === 'protection')
      .reduce((sum, l) => sum + l.amount, 0)
    if (dueTaxBase > 0) {
      const tax = Math.round((dueTaxBase * taxRate) / 100)
      dueLines.push({
        label: `Sales Tax (${taxRate}%)`,
        amount: tax,
        type: 'tax',
      })
    }

    if (futureLines.length > 0) {
      const futureTaxBase = futureLines.reduce((sum, l) => sum + l.amount, 0)
      if (futureTaxBase > 0) {
        const tax = Math.round((futureTaxBase * taxRate) / 100)
        futureLines.push({
          label: `Sales Tax (${taxRate}%)`,
          amount: tax,
          type: 'tax',
        })
      }
    }

    const recurringTaxBase = recurringLines
      .filter((l) => l.type === 'rent' || l.type === 'promotion' || l.type === 'protection')
      .reduce((sum, l) => sum + l.amount, 0)
    if (recurringTaxBase > 0) {
      const tax = Math.round((recurringTaxBase * taxRate) / 100)
      recurringLines.push({
        label: `Sales Tax (${taxRate}%)`,
        amount: tax,
        type: 'tax',
      })
    }
  }

  // If the promo has a finite duration applied to recurring, compute postPromoTotal
  // (recurring total without the promo discount line, but still including its own tax)
  if (
    promotion &&
    hasRecurringPromoActive &&
    !promotion.noExpiration &&
    promotion.durationCycles >= 1
  ) {
    const basePreTaxNoPromo = recurringLines
      .filter((l) => l.type === 'rent' || l.type === 'protection')
      .reduce((sum, l) => sum + l.amount, 0)
    const taxNoPromo =
      taxRate > 0 && basePreTaxNoPromo > 0
        ? Math.round((basePreTaxNoPromo * taxRate) / 100)
        : 0
    const postPromoTotal = basePreTaxNoPromo + taxNoPromo
    promoEndsAfter = {
      date: addMonths(recurringStart, promotion.durationCycles - 1),
      cycles: promotion.durationCycles,
      postPromoTotal,
    }
  }

  const dueTotal = dueLines.reduce((sum, l) => sum + l.amount, 0)
  const futureTotal = futureLines.reduce((sum, l) => sum + l.amount, 0)
  const recurringTotal = recurringLines.reduce((sum, l) => sum + l.amount, 0)

  return {
    dueToday: { lines: dueLines, total: dueTotal },
    futureCharge:
      futureLines.length > 0 ? { dueDate: anchor, lines: futureLines, total: futureTotal } : null,
    recurring: {
      startDate: recurringStart,
      lines: recurringLines,
      total: recurringTotal,
      ...(promoNote ? { promoNote } : {}),
      ...(promoEndsAfter ? { promoEndsAfter } : {}),
      ...(promoStartsAt ? { promoStartsAt } : {}),
    },
    appliedPromotion: appliedPromotionOut,
  }
}
