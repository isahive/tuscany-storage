import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateCharges, type CalculateChargesInput } from '../calculate-charges'

const baseUnit = { _id: 'u1', size: '10x10', type: 'standard', price: 11000 }
const baseSettings: CalculateChargesInput['settings'] = {
  billingCycleAnchor: 'first_of_month',
  billingCycleCustomDay: 1,
  prorationModel: 'first_month_full_then_prorate',
  prorationDaysBasis: 'actual_days_in_month',
  taxRate: 0,
}

test('Storable golden case: Apr 20, $110/mo, 50% promo, $12 protection, $100 deposit', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20), // Apr 20, 2026
    settings: baseSettings,
    promotion: {
      _id: 'p1',
      name: '50% off first month',
      description: '50% off first month',
      discountType: 'percentage',
      discountValue: 50,
      durationCycles: 1,
      noExpiration: false,
      beginsImmediately: true,
      beginsAfterCycles: 0,
    },
    protectionPlan: { _id: 'pp1', name: 'Standard', monthlyPrice: 1200 },
    depositAmount: 10000,
  })

  assert.equal(result.dueToday.total, 16700, 'dueToday should be $167.00')
  assert.ok(result.futureCharge, 'futureCharge should exist')
  assert.equal(result.futureCharge!.total, 4723, 'futureCharge should be $47.23')
  assert.equal(result.futureCharge!.dueDate.getFullYear(), 2026)
  assert.equal(result.futureCharge!.dueDate.getMonth(), 4) // May
  assert.equal(result.futureCharge!.dueDate.getDate(), 1)
  assert.equal(result.recurring.total, 12200, 'recurring should be $122.00')
  assert.equal(result.recurring.startDate.getFullYear(), 2026)
  assert.equal(result.recurring.startDate.getMonth(), 5) // June
  assert.equal(result.recurring.startDate.getDate(), 1)

  const rentLine = result.dueToday.lines.find((l) => l.type === 'rent')
  assert.ok(rentLine, 'rent line exists')
  assert.equal(rentLine!.amount, 11000)
  const promoLine = result.dueToday.lines.find((l) => l.type === 'promotion')
  assert.equal(promoLine!.amount, -5500)
  const depositLine = result.dueToday.lines.find((l) => l.type === 'deposit')
  assert.equal(depositLine!.amount, 10000)
})

test('No promo, no protection, sign on anchor day (Apr 1) — no proration needed', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 1),
    settings: baseSettings,
    promotion: null,
    protectionPlan: null,
    depositAmount: 11000,
  })

  assert.equal(result.dueToday.total, 22000, 'dueToday = $110 rent + $110 deposit')
  assert.equal(result.futureCharge, null, 'no futureCharge when sign date IS anchor')
  assert.equal(result.recurring.total, 11000, 'recurring = $110')
  assert.equal(result.recurring.startDate.getMonth(), 4) // May
  assert.equal(result.recurring.startDate.getDate(), 1)
})

test("prorationModel = 'none' — futureCharge null, dueToday has full first month", () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20),
    settings: { ...baseSettings, prorationModel: 'none' },
    promotion: null,
    protectionPlan: null,
    depositAmount: 11000,
  })

  assert.equal(result.futureCharge, null)
  assert.equal(result.dueToday.total, 22000) // 11000 rent + 11000 deposit
  const rent = result.dueToday.lines.find((l) => l.type === 'rent')
  assert.equal(rent!.amount, 11000)
})

test("Anchor = signup_day — futureCharge always null", () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20),
    settings: { ...baseSettings, billingCycleAnchor: 'signup_day' },
    promotion: null,
    protectionPlan: { _id: 'pp1', name: 'Standard', monthlyPrice: 1200 },
    depositAmount: 11000,
  })

  assert.equal(result.futureCharge, null, 'no proration with signup_day anchor')
  assert.equal(result.dueToday.total, 11000 + 1200 + 11000) // rent + protection + deposit
  assert.equal(result.recurring.total, 11000 + 1200)
  // Recurring starts next month on signup day
  assert.equal(result.recurring.startDate.getMonth(), 4) // May
  assert.equal(result.recurring.startDate.getDate(), 20)
})

test('Tax applied at 9.75% adds tax line to dueToday and recurring', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 1),
    settings: { ...baseSettings, taxRate: 9.75 },
    promotion: null,
    protectionPlan: { _id: 'pp1', name: 'Standard', monthlyPrice: 1200 },
    depositAmount: 11000,
  })

  // Tax base for dueToday: rent 11000 + protection 1200 = 12200
  // Tax = round(12200 * 9.75 / 100) = round(1189.5) = 1190
  const dueTaxLine = result.dueToday.lines.find((l) => l.type === 'tax')
  assert.ok(dueTaxLine, 'dueToday has tax line')
  assert.equal(dueTaxLine!.amount, 1190)
  assert.equal(result.dueToday.total, 11000 + 1200 + 1190 + 11000) // rent + protection + tax + deposit (deposit excluded from tax)

  const recTaxLine = result.recurring.lines.find((l) => l.type === 'tax')
  assert.ok(recTaxLine, 'recurring has tax line')
  assert.equal(recTaxLine!.amount, 1190)
  assert.equal(result.recurring.total, 11000 + 1200 + 1190)
})

test('first_of_month anchor when sign date is the 1st — no proration', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 5, 1), // June 1
    settings: baseSettings,
    promotion: null,
    protectionPlan: null,
    depositAmount: 0,
  })

  assert.equal(result.futureCharge, null, 'sign on anchor → no future charge')
  assert.equal(result.dueToday.total, 11000)
  assert.equal(result.recurring.startDate.getMonth(), 6) // July
})

test("prorate_first_month: dueToday = prorated only, recurring at next anchor", () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20),
    settings: { ...baseSettings, prorationModel: 'prorate_first_month' },
    promotion: null,
    protectionPlan: null,
    depositAmount: 10000,
  })

  // days = 12, dim = daysInMonth(Apr 20, actual) = 30
  // prorated = round(11000 * 12 / 30) = round(4400) = 4400
  assert.equal(result.futureCharge, null)
  assert.equal(result.dueToday.total, 4400 + 10000)
  assert.equal(result.recurring.startDate.getMonth(), 4) // May 1
  assert.equal(result.recurring.startDate.getDate(), 1)
})

test('Multi-cycle promo with expiration: 10% off for 6 cycles, beginsImmediately', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20), // Apr 20, 2026
    settings: baseSettings,
    promotion: {
      _id: 'p2',
      name: '10% off for 6 months',
      description: '10% off for 6 months',
      discountType: 'percentage',
      discountValue: 10,
      durationCycles: 6,
      noExpiration: false,
      beginsImmediately: true,
      beginsAfterCycles: 0,
    },
    protectionPlan: null,
    depositAmount: 0,
  })

  // recurring should have a discount line of -1100 (10% of 11000)
  const recPromo = result.recurring.lines.find((l) => l.type === 'promotion')
  assert.ok(recPromo, 'recurring has promotion line')
  assert.equal(recPromo!.amount, -1100)
  // recurring total = 11000 - 1100 = 9900
  assert.equal(result.recurring.total, 9900)
  // promoEndsAfter
  assert.ok(result.recurring.promoEndsAfter, 'promoEndsAfter present')
  assert.equal(result.recurring.promoEndsAfter!.cycles, 6)
  // postPromoTotal = recurring without promo = 11000
  assert.equal(result.recurring.promoEndsAfter!.postPromoTotal, 11000)
  // promoNote
  assert.equal(result.recurring.promoNote, '10% off for 6 months')
  // appliedPromotion at root
  assert.ok(result.appliedPromotion)
  assert.deepEqual(result.appliedPromotion!.effectiveCycles, { start: 1, end: 6 })
})

test('Multi-cycle promo no expiration: 10% off, noExpiration', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20),
    settings: baseSettings,
    promotion: {
      _id: 'p3',
      name: '10% off forever',
      description: 'Loyalty discount',
      discountType: 'percentage',
      discountValue: 10,
      durationCycles: 1, // ignored when noExpiration is true
      noExpiration: true,
      beginsImmediately: true,
      beginsAfterCycles: 0,
    },
    protectionPlan: null,
    depositAmount: 0,
  })

  const recPromo = result.recurring.lines.find((l) => l.type === 'promotion')
  assert.ok(recPromo, 'recurring has promotion line')
  assert.equal(recPromo!.amount, -1100)
  assert.equal(result.recurring.total, 9900)
  assert.equal(result.recurring.promoEndsAfter, undefined, 'no end date when noExpiration')
  assert.ok(result.recurring.promoNote && result.recurring.promoNote.includes('no expiration'))
  assert.ok(result.appliedPromotion)
  assert.deepEqual(result.appliedPromotion!.effectiveCycles, { start: 1, end: null })
})

test('Delayed promo: beginsAfterCycles=3, 10% off, durationCycles=3', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20), // Apr 20, 2026
    settings: baseSettings,
    promotion: {
      _id: 'p4',
      name: '10% off after 3 cycles',
      description: 'Loyalty kickoff',
      discountType: 'percentage',
      discountValue: 10,
      durationCycles: 3,
      noExpiration: false,
      beginsImmediately: false,
      beginsAfterCycles: 3,
    },
    protectionPlan: null,
    depositAmount: 0,
  })

  // dueToday and futureCharge must NOT have promo lines
  const duePromo = result.dueToday.lines.find((l) => l.type === 'promotion')
  assert.equal(duePromo, undefined, 'no promo on dueToday for delayed promo')
  if (result.futureCharge) {
    const futurePromo = result.futureCharge.lines.find((l) => l.type === 'promotion')
    assert.equal(futurePromo, undefined, 'no promo on futureCharge for delayed promo')
  }
  // recurring shows pre-promo amount
  const recPromo = result.recurring.lines.find((l) => l.type === 'promotion')
  assert.equal(recPromo, undefined, 'recurring shows pre-promo amount')
  assert.equal(result.recurring.total, 11000)
  // promoStartsAt
  assert.ok(result.recurring.promoStartsAt, 'promoStartsAt present')
  assert.equal(result.recurring.promoStartsAt!.cycles, 4)
  assert.ok(result.appliedPromotion)
  assert.deepEqual(result.appliedPromotion!.effectiveCycles, { start: 4, end: 6 })
})

test('durationCycles === 1 immediately: v1 behavior — promo on dueToday only, recurring untouched', () => {
  const result = calculateCharges({
    unit: baseUnit,
    signDate: new Date(2026, 3, 20),
    settings: baseSettings,
    promotion: {
      _id: 'p5',
      name: '50% off first month',
      description: '50% off first month',
      discountType: 'percentage',
      discountValue: 50,
      durationCycles: 1,
      noExpiration: false,
      beginsImmediately: true,
      beginsAfterCycles: 0,
    },
    protectionPlan: null,
    depositAmount: 0,
  })

  // dueToday gets the promo
  const duePromo = result.dueToday.lines.find((l) => l.type === 'promotion')
  assert.ok(duePromo, 'dueToday has promo')
  assert.equal(duePromo!.amount, -5500)
  // recurring untouched
  const recPromo = result.recurring.lines.find((l) => l.type === 'promotion')
  assert.equal(recPromo, undefined, 'recurring has no promotion line')
  assert.equal(result.recurring.total, 11000)
  assert.equal(result.recurring.promoNote, undefined)
  assert.equal(result.recurring.promoEndsAfter, undefined)
  assert.equal(result.recurring.promoStartsAt, undefined)
  // appliedPromotion still set with effectiveCycles 1..1
  assert.ok(result.appliedPromotion)
  assert.deepEqual(result.appliedPromotion!.effectiveCycles, { start: 1, end: 1 })
})
