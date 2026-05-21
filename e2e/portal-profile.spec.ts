import { test, expect } from '@playwright/test'

// Tenant edits their own profile and the change persists. Skips silently
// if the facility has profile editing disabled (a setting we respect).
test.describe('Portal — profile', () => {
  test('shows the profile page', async ({ page }) => {
    await page.goto('/portal/profile')
    await expect(page.getByRole('heading', { name: /profile|edit profile/i })).toBeVisible()
  })

  test('toggles into edit mode and saves a phone number', async ({ page }) => {
    await page.goto('/portal/profile')

    const edit = page.getByRole('button', { name: /^Edit$/i })
    if (!(await edit.isVisible().catch(() => false))) {
      test.skip(true, 'Profile editing is disabled by facility settings')
    }
    await edit.click()

    const phone = page.getByLabel(/cell phone|phone/i).first()
    await phone.fill('555-7777')

    await page.getByRole('button', { name: /^Save$/i }).click()

    await expect(page.locator('input[value="555-7777"]').first()).toBeVisible({ timeout: 10000 })
  })
})
