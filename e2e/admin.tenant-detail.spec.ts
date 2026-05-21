import { test, expect } from '@playwright/test'

// Admin smoke: tenants list loads, clicking through to a tenant shows the
// detail page with the new Move Out column. Doesn't mutate anything.
test.describe('Admin — tenant detail', () => {
  test('tenants list opens a detail page that includes a Move Out column', async ({ page }) => {
    await page.goto('/admin/tenants')
    await expect(page.getByRole('heading', { name: /Customers|Tenants/i })).toBeVisible()

    // Click the first tenant row — DataGrid renders the first cell as a link
    // when wired to the row click handler in our app.
    const firstRow = page.locator('[role="row"]').nth(1)
    await firstRow.click()

    await expect(page).toHaveURL(/\/admin\/tenants\/[^/]+$/)
    await expect(page.getByRole('heading', { name: /Customer Information/i })).toBeVisible()
    await expect(page.getByRole('cell', { name: /Move Out/i }).first()).toBeVisible()
  })
})
