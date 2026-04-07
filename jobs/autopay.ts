import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import type { ITenantDocument } from '@/models/Tenant'
import type { ILeaseDocument } from '@/models/Lease'

const isDev = process.env.NODE_ENV === 'development'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  try {
    // Dynamic import to avoid throwing when key is missing
    const Stripe = require('stripe')
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  } catch {
    return null
  }
}

function getBillingDateForMonth(billingDay: number, year: number, month: number): Date {
  // Clamp to last day of month if needed
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(billingDay, lastDay)
  return new Date(year, month, day)
}

export async function runAutopay(): Promise<void> {
  console.log('[Autopay] Starting autopay job...')
  await connectDB()

  const now = new Date()
  const twoDaysFromNow = new Date(now)
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

  // Find all active tenants with autopay enabled
  const tenants = await Tenant.find({
    autopayEnabled: true,
    status: 'active',
  }) as ITenantDocument[]

  console.log(`[Autopay] Found ${tenants.length} tenants with autopay enabled`)

  let processed = 0
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const tenant of tenants) {
    try {
      // Find their active lease
      const lease = await Lease.findOne({
        tenantId: tenant._id,
        status: 'active',
      }) as ILeaseDocument | null

      if (!lease) {
        console.log(`[Autopay] No active lease for tenant ${tenant.email}, skipping`)
        skipped++
        continue
      }

      // Check if billing day is within next 2 days
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      const billingDate = getBillingDateForMonth(lease.billingDay, currentYear, currentMonth)

      // If billing date already passed this month, check next month
      let targetBillingDate = billingDate
      if (billingDate < now) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
        targetBillingDate = getBillingDateForMonth(lease.billingDay, nextYear, nextMonth)
      }

      // Check if billing date is within 2 days
      const diffMs = targetBillingDate.getTime() - now.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      if (diffDays < 0 || diffDays > 2) {
        skipped++
        continue
      }

      // Check if payment already exists for this period
      const periodStart = new Date(targetBillingDate)
      const periodEnd = new Date(targetBillingDate)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      const existingPayment = await Payment.findOne({
        tenantId: tenant._id,
        leaseId: lease._id,
        type: 'rent',
        periodStart: { $gte: new Date(periodStart.getFullYear(), periodStart.getMonth(), 1) },
        periodEnd: { $lte: new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0) },
        status: { $in: ['pending', 'succeeded'] },
      })

      if (existingPayment) {
        console.log(`[Autopay] Payment already exists for tenant ${tenant.email} for this period, skipping`)
        skipped++
        continue
      }

      console.log(`[Autopay] Processing autopay for tenant ${tenant.email}, amount: $${(lease.monthlyRate / 100).toFixed(2)}`)

      let stripePaymentIntentId = `mock_pi_${Date.now()}_${tenant._id}`
      let paymentStatus: 'pending' | 'succeeded' | 'failed' = 'pending'
      let failureReason: string | undefined
      let stripeChargeId: string | undefined

      const stripe = getStripe()

      if (stripe && tenant.stripeCustomerId && tenant.defaultPaymentMethodId && !isDev) {
        // Real Stripe charge
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: lease.monthlyRate,
            currency: 'usd',
            customer: tenant.stripeCustomerId,
            payment_method: tenant.defaultPaymentMethodId,
            off_session: true,
            confirm: true,
            description: `Rent payment for unit - Tenant: ${tenant.firstName} ${tenant.lastName}`,
            metadata: {
              tenantId: tenant._id.toString(),
              leaseId: lease._id.toString(),
              type: 'rent',
            },
          })

          stripePaymentIntentId = paymentIntent.id
          stripeChargeId = paymentIntent.latest_charge as string | undefined

          if (paymentIntent.status === 'succeeded') {
            paymentStatus = 'succeeded'
            console.log(`[Autopay] Stripe charge succeeded for ${tenant.email}: ${paymentIntent.id}`)
          } else {
            paymentStatus = 'pending'
            console.log(`[Autopay] Stripe charge pending for ${tenant.email}: ${paymentIntent.id}, status: ${paymentIntent.status}`)
          }
        } catch (err: any) {
          paymentStatus = 'failed'
          failureReason = err.message || 'Stripe charge failed'
          console.error(`[Autopay] Stripe charge failed for ${tenant.email}: ${failureReason}`)
        }
      } else {
        // Dev mode or no Stripe configured — mock payment
        if (isDev) {
          console.log(`[Autopay][DEV] Mock payment for ${tenant.email}: $${(lease.monthlyRate / 100).toFixed(2)}`)
          paymentStatus = 'succeeded'
          stripePaymentIntentId = `dev_mock_pi_${Date.now()}_${tenant._id}`
        } else {
          console.log(`[Autopay] No Stripe config for ${tenant.email}, creating pending payment`)
          paymentStatus = 'pending'
        }
      }

      // Create Payment record
      await Payment.create({
        tenantId: tenant._id,
        leaseId: lease._id,
        unitId: lease.unitId,
        stripePaymentIntentId,
        stripeChargeId,
        amount: lease.monthlyRate,
        currency: 'usd',
        type: 'rent',
        status: paymentStatus,
        periodStart,
        periodEnd,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        failureReason,
      })

      processed++
      if (paymentStatus === 'succeeded') {
        succeeded++
      } else if (paymentStatus === 'failed') {
        failed++
      }
    } catch (err: any) {
      console.error(`[Autopay] Error processing tenant ${tenant.email}:`, err.message)
      failed++
    }
  }

  console.log(`[Autopay] Complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}, Skipped: ${skipped}`)
}
