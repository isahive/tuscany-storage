import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

/**
 * One-time login per role. Storage state is reused by every other spec so
 * the cost of NextAuth's credentials flow is paid once per test run.
 *
 * The test credentials come from `scripts/seed.ts` (admin) and
 * `scripts/seed-customers.ts` (tenant). If those change, update the env
 * defaults below or set the *_EMAIL / *_PASSWORD env vars in CI.
 */

const ADMIN_AUTH_FILE  = path.join(__dirname, '.auth/admin.json')
const TENANT_AUTH_FILE = path.join(__dirname, '.auth/tenant.json')

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? 'admin@tuscanystorage.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin123'
const TENANT_EMAIL    = process.env.E2E_TENANT_EMAIL    ?? 'john@example.com'
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD ?? 'tenant123'

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/admin/)
  await expect(page).toHaveURL(/\/admin/)
  await page.context().storageState({ path: ADMIN_AUTH_FILE })
})

setup('authenticate as tenant', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TENANT_EMAIL)
  await page.getByLabel(/password/i).fill(TENANT_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/portal/)
  await expect(page).toHaveURL(/\/portal/)
  await page.context().storageState({ path: TENANT_AUTH_FILE })
})
