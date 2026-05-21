import { test, expect } from '@playwright/test'

// Admin creates a brand-new tenant via /admin/tenants/new. Uses a
// timestamped email so reruns don't collide. The flow doesn't assign a
// unit (that's a separate admin-rent-unit spec) — we only verify the
// tenant gets created and the detail page renders.
test.describe('Admin — create tenant', () => {
  test('creates a new tenant from the New page', async ({ page }) => {
    await page.goto('/admin/tenants/new')
    const stamp = Date.now()
    const email = `e2e-${stamp}@test.local`

    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill(`Tenant${stamp}`)
    await page.getByLabel(/^email$/i).fill(email)
    await page.getByLabel(/phone/i).fill('555-9999')

    const passwordField = page.getByLabel(/password/i)
    if (await passwordField.isVisible().catch(() => false)) {
      await passwordField.fill('PasswordForTesting123')
    }

    const submit = page.getByRole('button', { name: /^Create|^Save|^Submit/i }).first()
    await submit.click()

    // Should land somewhere that references the new tenant
    await page.waitForURL(/\/admin\/tenants\/[^/]+/, { timeout: 10_000 })
    await expect(page.getByText(email)).toBeVisible()
  })
})
