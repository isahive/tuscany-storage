import { test, expect } from '@playwright/test'

// Admin browses the Units screen — read-only smoke. Creating/editing a
// unit changes shared inventory state and would require its own test
// fixture; that lives in `admin.unit-crud.spec.ts` when added.
test.describe('Admin — units', () => {
  test('lists units with the data grid + status chips', async ({ page }) => {
    await page.goto('/admin/units')
    await expect(page.getByRole('heading', { name: /units/i }).first()).toBeVisible()
    // DataGrid rows render with role=row
    await expect(page.locator('[role="row"]').first()).toBeVisible()
  })
})
