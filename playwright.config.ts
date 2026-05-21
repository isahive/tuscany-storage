import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — runs full-stack against a real Next.js dev server.
 *
 * Pre-reqs to run locally:
 *  - MongoDB reachable at MONGODB_URI (defaults to local instance)
 *  - `npm run seed` has been executed at least once so the test users exist
 *  - Stripe / Resend / Twilio test keys (or no keys → providers log + no-op)
 *
 * Auth state is built once by `e2e/auth.setup.ts` and shared across specs via
 * `storageState` so each spec doesn't re-login (which would be slow + flaky).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // serialized — the dev DB is shared state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html'], ['github']] : 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Build auth states once, then every other project depends on it.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium-tenant',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/tenant.json' },
      testIgnore: /admin\..*\.spec\.ts/,
    },
    {
      name: 'chromium-admin',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      testMatch: /admin\..*\.spec\.ts/,
    },
    // Multi-browser smoke — only the dashboard spec to keep CI time bounded.
    // Install with `npx playwright install firefox webkit` before running.
    {
      name: 'firefox-tenant',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: 'e2e/.auth/tenant.json' },
      testMatch: /portal-dashboard\.spec\.ts/,
    },
    {
      name: 'webkit-tenant',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: 'e2e/.auth/tenant.json' },
      testMatch: /portal-dashboard\.spec\.ts/,
    },
    // Mobile viewport — same dashboard smoke under iPhone 13 to catch
    // responsive regressions.
    {
      name: 'mobile-iphone-tenant',
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'], storageState: 'e2e/.auth/tenant.json' },
      testMatch: /portal-dashboard\.spec\.ts/,
    },
    // Accessibility scan — uses @axe-core/playwright to assert no critical/
    // serious violations on the portal dashboard.
    {
      name: 'a11y-tenant',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/tenant.json' },
      testMatch: /a11y\.spec\.ts/,
    },
  ],

  // Boot Next.js dev server unless one is already running. The check is
  // important so a developer running `npm run dev` in another terminal can
  // re-use that instance instead of spawning a second one.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
