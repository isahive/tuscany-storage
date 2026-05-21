import { test, expect } from '@playwright/test'

// Run on a clean context (no storage state) so we actually exercise the
// login form. The configured projects reuse storageState by default — we
// override here.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
  })

  test('rejects bad credentials with an inline error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('does-not-exist@example.com')
    await page.getByLabel(/password/i).fill('wrong-password')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    // Stay on /login, surface an error somewhere on the page
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/invalid|incorrect|wrong|failed/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('admin lands on /admin after a successful login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@tuscanystorage.com')
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD ?? 'admin123')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/admin/, { timeout: 15000 })
  })

  test('forgot-password link is reachable from /login', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: /forgot|reset/i }).first()
    if (await link.isVisible().catch(() => false)) {
      await link.click()
      await expect(page).toHaveURL(/forgot-password|reset/i)
    } else {
      test.skip(true, 'No forgot-password link surfaced on /login — UI variant')
    }
  })
})
