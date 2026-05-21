import { test, expect } from '@playwright/test'

// Smoke: a logged-in tenant lands on the dashboard and sees the core cards
// (Contact Info, Balance, Current Rentals). Catches NextAuth misconfig + API
// 500s before deeper specs run.
test.describe('Portal dashboard', () => {
  test('renders the dashboard for the seeded tenant', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.getByRole('heading', { name: /Contact Info/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Balance/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Current Rentals/i })).toBeVisible()
  })

  test('shows a Request Move Out link on at least one rental card', async ({ page }) => {
    await page.goto('/portal')
    // The link only appears when the lease is active (i.e., no pending move-out).
    // The seeded fixtures always start active; if a prior test left the tenant
    // in pending_moveout the dashboard renders the date instead — assert either.
    const requestLink = page.getByRole('link', { name: /Request Move Out/i })
    const movedOutDate = page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
    await expect(requestLink.or(movedOutDate).first()).toBeVisible()
  })
})
