import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { syncFacilityHoursToPdkSafe } from '@/lib/pdkFacilityHours'
import { ensureVisitorGroupSafe } from '@/lib/pdkVisitorGroup'
import { realignAllLeaseBillingDays } from '@/lib/billing/billingDay'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

type LateLienStatus = 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction'

// ── Validation schema (all fields optional — partial update) ──────────────────

const updateSettingsSchema = z
  .object({
    // Facility
    facilityName: z.string(),
    facilityAddress: z.string(),
    facilityCity: z.string(),
    facilityState: z.string(),
    facilityZip: z.string(),
    facilityPhone: z.string(),
    facilityEmail: z.string(),
    accessHoursStart: z.string(),
    accessHoursEnd: z.string(),
    // PDK gate-access wiring
    pdkTenantGroupId: z.string(),
    pdkEntryDeviceIds: z.array(z.string()),
    pdkExitDeviceIds: z.array(z.string()),
    // Text-to-open: phones authorized to open the gate via SMS.
    textToOpenAuthorizedPhones: z.array(z.string().trim()).transform((arr) =>
      // Strip empties, normalize to E.164-ish: keep leading '+' and digits only.
      arr.map((s) => {
        const t = s.trim()
        if (!t) return ''
        const hasPlus = t.startsWith('+')
        const digits = t.replace(/\D/g, '')
        return hasPlus ? `+${digits}` : digits
      }).filter(Boolean),
    ),
    // Locale
    locale: z.string(),
    currency: z.string(),
    dateFormat: z.string(),
    timeZone: z.string(),
    phoneFormat: z.string(),
    dimensionFormat: z.string(),
    customerNameFormat: z.enum(['last_first', 'first_last']),
    // Tax
    taxEnabled: z.boolean(),
    taxRate: z.number().min(0).max(100),
    // Billing
    billingDaysBeforeDue: z.number().int().min(0),
    // Billing Cycle
    billingCycleAnchor: z.enum(['first_of_month', 'signup_day', 'custom_day']),
    billingCycleCustomDay: z.number().int().min(1).max(28),
    // Proration
    prorationModel: z.enum(['none', 'custom', 'first_month_full_prorate_now', 'first_month_full_then_prorate', 'prorate_first_month', 'prorate_both']),
    prorationDaysBasis: z.enum(['actual_days_in_month', 'thirty_day_month']),
    // Fees
    lateFeeAfterDays: z.number().int().min(0),
    lateFeeAmount: z.number().int().min(0),
    nsfFeeAmount: z.number().int().min(0),
    auctionFeeAmount: z.number().int().min(0),
    auctionGracePeriodDays: z.number().int().min(0),
    auctionDaysAfterLockout: z.number().int().min(0).max(365),
    auctionFixedDate: z.string().nullable(),
    // Reservations
    enableReservations: z.boolean(),
    reservationLimitDays: z.number().int().min(0),
    // Customer permissions
    customersCanEditProfile: z.boolean(),
    customersCanEditBilling: z.boolean(),
    customersCanScheduleMoveOuts: z.boolean(),
    // New renter instructions
    newRenterInstructions: z.string(),
    // Lockout
    lockoutRequireApprovalAuto: z.boolean(),
    lockoutRequireApprovalManual: z.boolean(),
    // All fees — code tags system-managed entries
    customFees: z.array(z.object({
      id: z.string(),
      code: z.string().optional(),
      name: z.string(),
      amount: z.number().int().min(0),
      description: z.string(),
      active: z.boolean(),
    })),
    // Reservation fees
    unitTypeReservationFees: z.array(z.object({
      unitType: z.string().min(1),
      amount: z.number().int().min(0),
    })).superRefine((rows, ctx) => {
      const seen = new Set<string>()
      for (const r of rows) {
        if (seen.has(r.unitType)) {
          ctx.addIssue({
            code: 'custom',
            path: ['unitTypeReservationFees'],
            message: `Duplicate reservation fee for unit type ${r.unitType}`,
          })
        }
        seen.add(r.unitType)
      }
    }),
    // Rate Management
    rateManagementEnabled: z.boolean(),
    rateManagementReminderDay: z.number().int().min(1).max(28),
    rentalPriceAdvanceNoticeDays: z.number().int().min(0).max(365),
    rentalPriceAllowExceedingStreetRate: z.boolean(),
    rentalPriceRoundToNearestDollar: z.boolean(),
    unitTypePriceRules: z
      .array(
        z
          .object({
            id: z.string(),
            unitType: z.string().min(1),
            increaseAmount: z.number().int().min(0).optional(),
            increasePercent: z.number().min(0).max(100).optional(),
            minOccupancyPct: z.number().min(0).max(100),
            roundingRule: z.enum(['none', 'nearest_dollar']).default('nearest_dollar'),
          })
          .refine(
            (r) => r.increaseAmount !== undefined || r.increasePercent !== undefined,
            { message: 'Either increaseAmount or increasePercent is required' },
          ),
      )
      .superRefine((rules, ctx) => {
        // Storable parity: at most ONE rule per unit type (per rule type).
        const seen = new Set<string>()
        for (const r of rules) {
          if (seen.has(r.unitType)) {
            ctx.addIssue({
              code: 'custom',
              path: ['unitTypePriceRules'],
              message: `Only one Unit Type Price rule allowed per unit type (duplicate: ${r.unitType})`,
            })
          }
          seen.add(r.unitType)
        }
      }),
    rentalPriceRules: z
      .array(
        z
          .object({
            id: z.string(),
            unitType: z.string().min(1),
            increaseAmount: z.number().int().min(0).optional(),
            increasePercent: z.number().min(0).max(100).optional(),
            minMonthsSinceLastChange: z.number().int().min(0).max(120),
          })
          .refine(
            (r) => r.increaseAmount !== undefined || r.increasePercent !== undefined,
            { message: 'Either increaseAmount or increasePercent is required' },
          ),
      )
      .superRefine((rules, ctx) => {
        const seen = new Set<string>()
        for (const r of rules) {
          if (seen.has(r.unitType)) {
            ctx.addIssue({
              code: 'custom',
              path: ['rentalPriceRules'],
              message: `Only one Rental Price rule allowed per unit type (duplicate: ${r.unitType})`,
            })
          }
          seen.add(r.unitType)
        }
      }),
    // Late / Lien
    lateLienEvents: z
      .array(z.object({
        id: z.string(),
        status: z.enum(['late', 'locked_out', 'pre_lien', 'lien', 'auction']),
        daysPastDue: z.number().int().min(0),
        notifyEmail: z.boolean(),
        notifyText: z.boolean(),
        notifyLetter: z.boolean(),
        notificationTemplate: z.string(),
        fees: z.array(z.object({ name: z.string(), amount: z.number().int().min(0) })),
        actions: z.array(z.string()),
      }))
      // Storable parity — Locked Out >= Late + 1, Pre-Lien >= Locked Out + 1,
      // Lien >= Pre-Lien + 1, Auction >= Lien + 1. Enforced on max(prev) <
      // min(next) so multiple events of the same status are allowed.
      .superRefine((evts, ctx) => {
        const order: LateLienStatus[] = ['late', 'locked_out', 'pre_lien', 'lien', 'auction']
        const ranges: Partial<Record<LateLienStatus, { min: number; max: number }>> = {}
        for (const e of evts) {
          const r = ranges[e.status]
          ranges[e.status] = r
            ? { min: Math.min(r.min, e.daysPastDue), max: Math.max(r.max, e.daysPastDue) }
            : { min: e.daysPastDue, max: e.daysPastDue }
        }
        for (let i = 0; i < order.length - 1; i++) {
          const cur = ranges[order[i]]
          const next = ranges[order[i + 1]]
          if (cur && next && next.min <= cur.max) {
            ctx.addIssue({
              code: 'custom',
              path: ['lateLienEvents'],
              message: `${order[i + 1]} (day ${next.min}) must be at least 1 day after the latest ${order[i]} rule (day ${cur.max})`,
            })
          }
        }
      }),
    // Gate
    gateAutoAssign: z.boolean(),
    gateAutoAssignMethod: z.enum(['phone_last4', 'random']),
    gateCodeLength: z.number().int().min(4).max(6),
    gateAutoLockout: z.boolean(),
    gateTextToOpen: z.boolean(),
    gateTextToOpenNumber: z.string(),
    gateControllerType: z.string(),
    gateNodeId: z.string(),
    gateApiEndpoint: z.string(),
    gateApiKey: z.string(),
    // Agreement
    agreementTitle: z.string(),
    agreementTemplate: z.string(),
    // Email branding
    emailLogoUrl: z.string(),
    // Customer form fields
    customerFormFields: z.array(z.object({
      key: z.string(),
      label: z.string(),
      showOnSignup: z.boolean(),
      requiredOnSignup: z.boolean(),
      showOnWaitingList: z.boolean(),
      requiredOnWaitingList: z.boolean(),
      isCustom: z.boolean(),
      order: z.number().int().min(0),
      fieldType: z.enum(['text', 'select', 'checkbox']).optional(),
      options: z.array(z.string()).optional(),
      helpText: z.string().optional(),
    })),
  })
  .partial()

// ── GET /api/settings ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const settings = await Settings.findOne({})
    return NextResponse.json({ success: true, data: settings ?? DEFAULT_SETTINGS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── PUT /api/settings ─────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    // When sales tax is switched off, force the stored rate to 0 so every
    // consumer (checkouts, statements, receipts, line items) drops tax with
    // no extra wiring — the whole codebase already hides tax when rate is 0.
    if (parsed.data.taxEnabled === false) {
      parsed.data.taxRate = 0
    }

    await connectDB()

    // Capture the pre-save state so we know whether to re-push the access-
    // hours/devices config to PDK. Pushing on every settings PUT would work
    // but burns API calls unnecessarily.
    const before = await Settings.findOne({}).select(
      'accessHoursStart accessHoursEnd pdkEntryDeviceIds pdkExitDeviceIds billingCycleAnchor billingCycleCustomDay',
    ).lean<{
      accessHoursStart?: string
      accessHoursEnd?: string
      pdkEntryDeviceIds?: string[]
      pdkExitDeviceIds?: string[]
      billingCycleAnchor?: 'first_of_month' | 'signup_day' | 'custom_day'
      billingCycleCustomDay?: number
    } | null>()

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    const gateConfigChanged =
      before?.accessHoursStart !== updatedSettings.accessHoursStart
      || before?.accessHoursEnd !== updatedSettings.accessHoursEnd
      || JSON.stringify(before?.pdkEntryDeviceIds ?? []) !== JSON.stringify(updatedSettings.pdkEntryDeviceIds ?? [])
      || JSON.stringify(before?.pdkExitDeviceIds ?? []) !== JSON.stringify(updatedSettings.pdkExitDeviceIds ?? [])
    if (gateConfigChanged) {
      await syncFacilityHoursToPdkSafe()
      // Visitor group rules also bind to entry/exit devices. Without this
      // call the visitor group keeps pointing at the previous device set
      // and currently-active visitor passes silently break when keys are
      // tried at the new readers.
      await ensureVisitorGroupSafe()
    }

    // When the billing anchor changes, realign every active lease so the
    // admin's choice takes effect immediately instead of only applying to
    // future signups. Skipped silently when nothing relevant changed.
    const billingAnchorChanged =
      before?.billingCycleAnchor !== updatedSettings.billingCycleAnchor
      || before?.billingCycleCustomDay !== updatedSettings.billingCycleCustomDay
    let leaseRealign: { scanned: number; changed: number } | undefined
    if (billingAnchorChanged) {
      leaseRealign = await realignAllLeaseBillingDays({
        billingCycleAnchor: updatedSettings.billingCycleAnchor,
        billingCycleCustomDay: updatedSettings.billingCycleCustomDay,
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      ...(leaseRealign ? { leaseRealign } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
