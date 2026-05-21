import { test, expect } from '@playwright/test'

// Anonymous user lands on /units, sees the public listing, and clicking
// a unit reaches a reserve/rent page. Stops short of submitting the
// payment because we don't fill the Stripe iframe in smoke specs.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Public rent-online', () => {
  test('lists available units', async ({ page }) => {
    await page.goto('/units')
    await expect(page.getByRole('heading', { name: /storage|units|rent/i }).first()).toBeVisible()
  })

  test('selecting a unit navigates somewhere with reserve/rent intent', async ({ page }) => {
    await page.goto('/units')
    const cta = page.getByRole('link', { name: /^Reserve|^Rent|Select|Continue/i }).first()
    if (!(await cta.isVisible().catch(() => false))) {
      test.skip(true, 'No reserve CTA on the unit listing — all units rented or no inventory seeded')
    }
    await cta.click()
    await expect(page).toHaveURL(/(reserve|rent|checkout|units\/[^/]+)/i)
  })
})
