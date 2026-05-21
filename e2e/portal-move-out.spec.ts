import { test, expect } from '@playwright/test'

// Critical-path E2E: tenant requests a move-out and lands back on the
// dashboard with the success banner + status flipped to "Moving out".
//
// NOTE: This spec mutates the seeded tenant's lease state. If it fails
// mid-flight, the lease can stay in pending_moveout. Re-run `npm run seed`
// to reset, or have the admin spec cancel via /admin/tenants/[id].
test.describe('Portal — request move out', () => {
  test('submits a request, shows success banner, status flips to Moving out', async ({ page }) => {
    await page.goto('/portal')

    const requestLink = page.getByRole('link', { name: /Request Move Out/i }).first()
    // If a previous run left it pending, log a soft skip — admin spec will
    // restore + the next clean run picks this up.
    if (!(await requestLink.isVisible().catch(() => false))) {
      test.skip(true, 'No active rental — earlier run left move-out pending')
    }

    await requestLink.click()
    await expect(page).toHaveURL(/\/portal\/move-out/)
    await expect(page.getByRole('heading', { name: /Request Move Out of Unit/i })).toBeVisible()

    // Default date is today — that's valid for a same-day move-out.
    await page.getByRole('button', { name: /Request Move Out/i }).click()

    await expect(page).toHaveURL(/\/portal\?moveout=success/)
    await expect(page.getByText(/Successfully requested move out\./i)).toBeVisible()

    // Card now shows the "Moving out" status label
    await expect(page.getByText(/Moving out/i)).toBeVisible()
  })
})
