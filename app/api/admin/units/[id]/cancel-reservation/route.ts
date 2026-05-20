import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import { refundAmountForCancel } from '@/lib/reservationFee'

// POST /api/admin/units/[id]/cancel-reservation
// Storable parity:
//   - Frees the unit (status → 'available').
//   - Refunds the reservation fee via Stripe IF it was actually captured AND
//     the reservation hasn't yet been converted to an active lease.
// Returns a small refund summary so the caller can confirm to the admin.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const unit = await Unit.findById(params.id)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'reserved') {
      return NextResponse.json({ success: false, error: 'Unit is not reserved.' }, { status: 409 })
    }

    // A reservation may already have been promoted to a rental — in that case
    // an active Lease for the reserved tenant exists. Refunds aren't allowed
    // after conversion (the fee became a credit on the first invoice).
    const convertedLease = await Lease.findOne({
      tenantId: unit.reservedTenantId,
      unitId: unit._id,
      status: 'active',
    })
    const convertedToLease = !!convertedLease

    const paid = unit.reservationFeePaid ?? 0
    const refund = refundAmountForCancel({ paidAmount: paid, convertedToLease })

    let stripeRefundId: string | undefined
    if (refund > 0 && unit.reservationPaymentIntentId && process.env.STRIPE_SECRET_KEY) {
      try {
        const { stripe } = await import('@/lib/stripe')
        const refundResp = await stripe.refunds.create({
          payment_intent: unit.reservationPaymentIntentId,
          amount: refund,
          reason: 'requested_by_customer',
          metadata: { unitId: String(unit._id), reason: 'reservation_cancelled' },
        })
        stripeRefundId = refundResp.id
      } catch (stripeErr) {
        const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe refund failed'
        return NextResponse.json({ success: false, error: msg }, { status: 402 })
      }
    }

    // Reset reservation state. We keep reservationPaymentIntentId so support
    // can trace the refund back to the original capture.
    unit.status = 'available'
    unit.reservedTenantId = undefined
    unit.reservedAt = undefined
    unit.reservedMoveInDate = undefined
    unit.reservedPrice = undefined
    unit.reservationFeePaid = undefined
    unit.reservationFeePaidAt = undefined
    await unit.save()

    return NextResponse.json({
      success: true,
      data: { refunded: refund, stripeRefundId, convertedToLease },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
