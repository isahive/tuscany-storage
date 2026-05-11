import Promotion from '@/models/Promotion'
import Payment from '@/models/Payment'
import type { Types } from 'mongoose'

interface PromotionResult {
  discountedAmount: number      // cents — actual amount to charge
  discount: number              // cents — discount applied (0 if none)
  promotionId?: string
  reason?: 'expired' | 'inactive' | 'duration_exceeded' | 'no_promotion' | 'not_found'
}

/**
 * Given a base rent amount and a lease's appliedPromotionId, return the
 * amount to actually charge after promo discount.
 * Promotion applies for `durationCycles` cycles unless `noExpiration`.
 * Cycle count is derived from succeeded 'rent' payments on the lease.
 */
export async function applyPromotionToCharge(
  baseAmount: number,
  leaseId: Types.ObjectId | string,
  appliedPromotionId?: Types.ObjectId | string | null,
): Promise<PromotionResult> {
  if (!appliedPromotionId) {
    return { discountedAmount: baseAmount, discount: 0, reason: 'no_promotion' }
  }

  const promo = await Promotion.findById(appliedPromotionId)
  if (!promo) {
    return { discountedAmount: baseAmount, discount: 0, reason: 'not_found' }
  }
  if (promo.status !== 'active') {
    return { discountedAmount: baseAmount, discount: 0, reason: 'inactive', promotionId: promo._id.toString() }
  }

  // Check date validity
  const now = new Date()
  if (promo.endDate && !promo.noExpiration && new Date(promo.endDate) < now) {
    return { discountedAmount: baseAmount, discount: 0, reason: 'expired', promotionId: promo._id.toString() }
  }

  // Determine cycles already applied
  if (!promo.noExpiration && promo.durationCycles > 0) {
    const cyclesUsed = await Payment.countDocuments({
      leaseId,
      type: 'rent',
      status: 'succeeded',
    })
    // First payment is the move-in, so cycle 1 of promo applies at move-in
    if (cyclesUsed >= promo.durationCycles) {
      return {
        discountedAmount: baseAmount,
        discount: 0,
        reason: 'duration_exceeded',
        promotionId: promo._id.toString(),
      }
    }
  }

  // Apply discount
  let discount = 0
  if (promo.discountType === 'percentage') {
    discount = Math.round((baseAmount * promo.discountValue) / 100)
  } else {
    discount = Math.min(promo.discountValue, baseAmount)
  }
  return {
    discountedAmount: Math.max(0, baseAmount - discount),
    discount,
    promotionId: promo._id.toString(),
  }
}
