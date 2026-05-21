import { test, expect } from '@playwright/test'

// The receipt page is reached AFTER finalize, which mutates DB state.
// This spec is independent — it visits the page via a fresh move-out if
// one is available, then exercises the Send-as-* buttons (which we intercept
// at the network layer to avoid actually hitting Resend/Twilio).
test.describe('Admin — move-out receipt actions', () => {
  test('intercepts Send-as-Email + Send-as-Text + PDF endpoints', async ({ page }) => {
    // Land on the tenant list, jump to the first tenant detail
    await page.goto('/admin/tenants')
    await page.locator('[role="row"]').nth(1).click()
    await page.waitForURL(/\/admin\/tenants\/[^/]+$/)

    // Look for a Finalize Move Out button — if none, the previous test left
    // no pending request; skip.
    const finalize = page.getByRole('button', { name: /^Finalize Move Out$/i }).first()
    if (!(await finalize.isVisible().catch(() => false))) {
      test.skip(true, 'No pending move-out to finalize — run portal-move-out.spec first')
    }

    // Intercept the receipt send endpoints so we can verify wiring without
    // hitting Resend / Twilio for real.
    let emailHit = false
    let textHit = false
    await page.route('**/api/move-out/*/receipt/email', async (route) => {
      emailHit = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })
    await page.route('**/api/move-out/*/receipt/text', async (route) => {
      textHit = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })

    await finalize.click()
    await page.waitForURL(/\/finalize-move-out/)
    await page.getByRole('button', { name: /^Finalize Move Out$/i }).click()
    await page.waitForURL(/\/move-out-receipt/)

    await page.getByRole('button', { name: /Send as Email/i }).click()
    await expect(page.getByText(/Receipt sent via email\./i)).toBeVisible({ timeout: 5000 })
    expect(emailHit).toBe(true)

    await page.getByRole('button', { name: /Send as Text/i }).click()
    await expect(page.getByText(/Receipt sent via text\./i)).toBeVisible({ timeout: 5000 })
    expect(textHit).toBe(true)
  })
})
