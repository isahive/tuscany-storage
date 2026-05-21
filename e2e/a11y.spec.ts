import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Accessibility scan — runs axe-core against the portal dashboard. We assert
// no critical or serious violations. Lower-severity issues are reported but
// don't block CI so the team has a backlog to grind through.
test.describe('Accessibility', () => {
  test('portal dashboard has no critical/serious axe violations', async ({ page }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    if (blocking.length > 0) {
      console.log('Axe violations:', JSON.stringify(blocking, null, 2))
    }
    expect(blocking).toEqual([])
  })
})
