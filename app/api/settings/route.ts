import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

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
    // Locale
    locale: z.string(),
    currency: z.string(),
    dateFormat: z.string(),
    timeZone: z.string(),
    phoneFormat: z.string(),
    dimensionFormat: z.string(),
    // Billing
    billingDaysBeforeDue: z.number().int().min(0),
    daysRequiredBeforeBillingDay: z.number().int().min(0),
    // Fees
    lateFeeAfterDays: z.number().int().min(0),
    lateFeeAmount: z.number().int().min(0),
    nsfFeeAmount: z.number().int().min(0),
    auctionFeeAmount: z.number().int().min(0),
    // Rental options
    enablePrepay: z.boolean(),
    disablePartialPaymentsForLockedOut: z.boolean(),
    saveUnpaidRentals: z.boolean(),
    autoAcknowledgeRentals: z.boolean(),
    enableAdditionalDeposits: z.boolean(),
    customerRentalProrating: z.boolean(),
    defaultProratingForManagerRentals: z.boolean(),
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
    // Custom fees
    customFees: z.array(z.object({
      id: z.string(),
      name: z.string(),
      amount: z.number().int().min(0),
      description: z.string(),
      active: z.boolean(),
    })),
    // Late / Lien
    lateLienEvents: z.array(z.object({
      id: z.string(),
      status: z.enum(['late', 'locked_out', 'pre_lien', 'lien', 'auction']),
      daysPastDue: z.number().int().min(0),
      notifyEmail: z.boolean(),
      notifyText: z.boolean(),
      notifyLetter: z.boolean(),
      notificationTemplate: z.string(),
      fees: z.array(z.object({ name: z.string(), amount: z.number().int().min(0) })),
      actions: z.array(z.string()),
    })),
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

    await connectDB()

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    return NextResponse.json({ success: true, data: updatedSettings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
