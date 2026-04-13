import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

// GET /api/settings/public
// Returns only settings the customer portal needs — no auth required.
export async function GET() {
  try {
    await connectDB()
    const s = await Settings.findOne({}).lean()

    // Form fields — merge defaults if DB is empty
    const formFields = (s?.customerFormFields && s.customerFormFields.length > 0)
      ? s.customerFormFields
      : DEFAULT_SETTINGS.customerFormFields

    return NextResponse.json({
      success: true,
      data: {
        facilityName: s?.facilityName ?? 'Tuscany Village Self Storage',
        facilityPhone: s?.facilityPhone ?? '(865) 426-2100',
        accessHoursStart: s?.accessHoursStart ?? '05:00',
        accessHoursEnd: s?.accessHoursEnd ?? '22:00',
        customersCanEditProfile: s?.customersCanEditProfile ?? true,
        customersCanEditBilling: s?.customersCanEditBilling ?? true,
        customersCanScheduleMoveOuts: s?.customersCanScheduleMoveOuts ?? true,
        newRenterInstructions: s?.newRenterInstructions ?? '',
        enablePrepay: s?.enablePrepay ?? false,
        disablePartialPaymentsForLockedOut: s?.disablePartialPaymentsForLockedOut ?? false,
        gateTextToOpen: s?.gateTextToOpen ?? false,
        gateTextToOpenNumber: s?.gateTextToOpenNumber ?? '',
        customerFormFields: formFields,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
