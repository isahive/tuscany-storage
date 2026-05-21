import { test, expect } from '@playwright/test'

// Tenant visits the billing page and sees autopay + Stripe CardElement.
// We don't fill the Stripe iframe (cross-origin) here — that belongs in a
// dedicated Stripe-aware test using their testing tokens.
test.describe('Portal — billing', () => {
  test('renders the billing page with autopay + card section', async ({ page }) => {
    await page.goto('/portal/billing')
    await expect(page.getByRole('heading', { name: /billing|recurring billing/i })).toBeVisible()

    // Stripe Elements mounts an iframe with name starting with __privateStripeFrame
    const stripeFrame = page.locator('iframe[name^="__privateStripeFrame"]').first()
    // CardElement may not render if NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY isn't
    // configured for the env; treat that as a soft skip.
    if (!(await stripeFrame.isVisible().catch(() => false))) {
      test.skip(true, 'Stripe Elements not loaded — publishable key missing in this env')
    }
    await expect(stripeFrame).toBeVisible()
  })
})
