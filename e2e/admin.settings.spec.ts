import { test, expect } from '@playwright/test'

// Admin loads the rental settings page, flips a customer-permission toggle,
// saves, reloads, and confirms the value persisted. Resets at the end.
test.describe('Admin — rental settings', () => {
  test('Customer Permissions block has the three move-out toggles', async ({ page }) => {
    await page.goto('/admin/settings/rental')
    await expect(page.getByRole('heading', { name: /Rental Settings/i })).toBeVisible()
    await expect(page.getByText(/Customer Permissions/i)).toBeVisible()
    await expect(page.getByText(/Customers Can Schedule Move Outs/i)).toBeVisible()
    await expect(page.getByText(/Customers Can Edit Profile Information/i)).toBeVisible()
    await expect(page.getByText(/Customers Can Edit Billing Information/i)).toBeVisible()
  })

  test('toggle persists after save + reload', async ({ page }) => {
    await page.goto('/admin/settings/rental')

    const switchEl = page
      .locator('label', { hasText: /Customers Can Schedule Move Outs/i })
      .locator('input[type="checkbox"]')

    const initial = await switchEl.isChecked()
    if (initial) await switchEl.uncheck()
    else await switchEl.check()

    await page.getByRole('button', { name: /^Save$/i }).click()
    await expect(page.getByText(/saved|Settings saved/i).first()).toBeVisible({ timeout: 8000 })

    await page.reload()
    const after = await switchEl.isChecked()
    expect(after).not.toBe(initial)

    // Revert so the next run sees the same starting state
    if (after) await switchEl.uncheck()
    else await switchEl.check()
    await page.getByRole('button', { name: /^Save$/i }).click()
  })
})
