/** Minimal shape — kept local to avoid cyclic imports with the Tenant model. */
interface CardFingerprintTarget {
  defaultPaymentMethodId?: string | null
  cardFingerprint?: string
}

/**
 * Refresh `tenant.cardFingerprint` to match the current
 * `tenant.defaultPaymentMethodId`. Wired up as a `pre-save` hook on the Tenant
 * model so every code path that changes the default payment method (admin
 * set-card, portal save-payment-method, setup intent confirmation, autopay
 * capture, …) gets the fingerprint reconciled.
 *
 * The fingerprint is what makes the duplicate-tenant scanner cheap: it can
 * match "same physical card" in plain Mongo without round-tripping to Stripe
 * per tenant.
 *
 * Failures are swallowed — the fingerprint is a best-effort cache, and the
 * one-time backfill script (`scripts/backfillCardFingerprints.ts`) reconciles
 * anything that drifts.
 */
export async function syncCardFingerprint(tenant: CardFingerprintTarget): Promise<void> {
  if (!tenant.defaultPaymentMethodId) {
    if (tenant.cardFingerprint) tenant.cardFingerprint = undefined
    return
  }
  if (!process.env.STRIPE_SECRET_KEY) return
  try {
    const { stripe } = await import('@/lib/stripe')
    const pm = await stripe.paymentMethods.retrieve(tenant.defaultPaymentMethodId)
    tenant.cardFingerprint = pm.card?.fingerprint ?? undefined
  } catch (err) {
    console.error('syncCardFingerprint failed', err)
  }
}
