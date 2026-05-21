import { test, expect } from '@playwright/test'

// Admin opens /admin/communications/templates and verifies the seeded
// "Move Out Receipt" template appears and is editable.
test.describe('Admin — communication templates', () => {
  test('"Move Out Receipt" template appears in the list', async ({ page }) => {
    await page.goto('/admin/communications/templates')
    await expect(page.getByRole('heading', { name: /templates/i }).first()).toBeVisible()
    await expect(page.getByText(/Move Out Receipt/i).first()).toBeVisible()
  })

  test('opens the template detail page', async ({ page }) => {
    await page.goto('/admin/communications/templates')
    await page.getByText(/^Move Out Receipt$/i).first().click()
    await expect(page).toHaveURL(/\/admin\/communications\/templates\//)
    await expect(page.getByText(/Email|Subject|Content/i).first()).toBeVisible()
  })
})
