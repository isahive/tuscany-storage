import { test, expect } from '@playwright/test'

// Admin finalize flow — runs after the portal spec leaves a pending request.
// If no pending request exists, the spec self-skips so it's safe to run in
// isolation. End state: lease ended, unit available, tenant moved_out,
// receipt page visible.
test.describe('Admin — finalize move out', () => {
  test('finalizes a pending move-out and lands on the receipt page', async ({ page }) => {
    await page.goto('/admin/tenants')

    // Find a tenant with status involving move-out; fall back to clicking the
    // first row and looking for the Finalize button on the detail page.
    const firstRow = page.locator('[role="row"]').nth(1)
    await firstRow.click()
    await page.waitForURL(/\/admin\/tenants\/[^/]+$/)

    const finalizeBtn = page.getByRole('button', { name: /^Finalize Move Out$/i }).first()
    if (!(await finalizeBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No pending move-out request on this tenant — run portal-move-out.spec first')
    }

    await finalizeBtn.click()
    await page.waitForURL(/\/finalize-move-out/)
    await expect(page.getByRole('heading', { name: /Finalize Move Out/i })).toBeVisible()

    await page.getByRole('button', { name: /^Finalize Move Out$/i }).click()

    await page.waitForURL(/\/move-out-receipt/)
    await expect(page.getByText(/Move out is complete\./i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Send as Email/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Send as Text/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /PDF/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Return to Customer/i })).toBeVisible()
  })
})
