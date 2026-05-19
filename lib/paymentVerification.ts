import PaymentVerification from '@/models/PaymentVerification'

// ─── Thresholds (mirror Storable Easy) ───────────────────────────────────────
const FAILED_PAYMENT_THRESHOLD = 5
const SCREEN_OPEN_THRESHOLD = 5
const MANUAL_CHARGE_WINDOW_MS = 60 * 60 * 1000
const MANUAL_CHARGE_THRESHOLD = 3
// Once tripped, CAPTCHA stays required for 24h or until a successful payment
// clears the streak — whichever comes first.
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export type VerificationKey = `tenant:${string}` | `admin:${string}`

export interface VerificationStatus {
  required: boolean
  reason?: string
  expiresAt?: Date
}

export function tenantKey(id: string): VerificationKey {
  return `tenant:${id}`
}
export function adminKey(id: string): VerificationKey {
  return `admin:${id}`
}

async function loadOrCreate(key: VerificationKey) {
  const existing = await PaymentVerification.findOne({ key })
  if (existing) return existing
  return PaymentVerification.create({ key })
}

export async function getVerificationStatus(
  key: VerificationKey,
): Promise<VerificationStatus> {
  const doc = await PaymentVerification.findOne({ key }).lean<{
    verificationRequiredUntil?: Date | null
    verificationReason?: string | null
  } | null>()
  if (!doc?.verificationRequiredUntil) return { required: false }
  if (new Date(doc.verificationRequiredUntil).getTime() < Date.now()) {
    return { required: false }
  }
  return {
    required: true,
    reason: doc.verificationReason ?? undefined,
    expiresAt: doc.verificationRequiredUntil,
  }
}

export async function recordFailedPayment(key: VerificationKey): Promise<void> {
  const doc = await loadOrCreate(key)
  doc.failedPaymentStreak = (doc.failedPaymentStreak ?? 0) + 1
  if (doc.failedPaymentStreak >= FAILED_PAYMENT_THRESHOLD) {
    doc.verificationRequiredUntil = new Date(Date.now() + VERIFICATION_TTL_MS)
    doc.verificationReason = `${doc.failedPaymentStreak} consecutive failed payments`
  }
  await doc.save()
}

export async function recordSuccessfulPayment(key: VerificationKey): Promise<void> {
  // Single atomic update — concurrent successes can't leave half-reset state.
  await PaymentVerification.updateOne(
    { key },
    {
      $set: {
        failedPaymentStreak: 0,
        screenOpensSinceSuccess: 0,
        verificationRequiredUntil: null,
        verificationReason: null,
      },
      $setOnInsert: { key },
    },
    { upsert: true },
  )
}

export async function recordScreenOpen(key: VerificationKey): Promise<void> {
  const doc = await loadOrCreate(key)
  doc.screenOpensSinceSuccess = (doc.screenOpensSinceSuccess ?? 0) + 1
  if (doc.screenOpensSinceSuccess >= SCREEN_OPEN_THRESHOLD) {
    doc.verificationRequiredUntil = new Date(Date.now() + VERIFICATION_TTL_MS)
    doc.verificationReason = `Payment screen opened ${doc.screenOpensSinceSuccess} times without a successful payment`
  }
  await doc.save()
}

/**
 * Records a successful manual admin charge and prunes the trailing-hour window.
 * Returns `{ tripped: true }` if this charge pushed the admin over Storable's
 * ">3 manual payments in 1 hour" line; callers should refuse subsequent
 * charges until verification passes.
 */
export async function recordManualCharge(
  key: VerificationKey,
): Promise<{ tripped: boolean }> {
  const doc = await loadOrCreate(key)
  const cutoff = Date.now() - MANUAL_CHARGE_WINDOW_MS
  const recent = (doc.recentManualCharges ?? []).filter(
    (d: Date) => new Date(d).getTime() > cutoff,
  )
  recent.push(new Date())
  doc.recentManualCharges = recent
  if (recent.length > MANUAL_CHARGE_THRESHOLD) {
    doc.verificationRequiredUntil = new Date(Date.now() + VERIFICATION_TTL_MS)
    doc.verificationReason = `${recent.length} manual charges in the last hour`
    await doc.save()
    return { tripped: true }
  }
  await doc.save()
  return { tripped: false }
}

export async function recordPaymentWithoutRental(key: VerificationKey): Promise<void> {
  await PaymentVerification.updateOne(
    { key },
    {
      $set: {
        verificationRequiredUntil: new Date(Date.now() + VERIFICATION_TTL_MS),
        verificationReason: 'Payment attempted without an active rental',
      },
      $setOnInsert: { key },
    },
    { upsert: true },
  )
}
