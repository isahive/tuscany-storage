# Testing Guide

Comprehensive guide to the test stack, conventions, and the full case matrix for `tuscany-storage`.

---

## Stack at a glance

| Layer            | Tool                                | Where                          |
|------------------|-------------------------------------|--------------------------------|
| Unit / API       | **Vitest** (node env)               | `lib/**/*.test.ts`, `tests/unit/**/*.test.ts` |
| Component        | **Vitest + React Testing Library** (happy-dom env) | `tests/components/**/*.test.tsx` |
| E2E              | **Playwright** (Chromium)           | `e2e/**/*.spec.ts`             |
| DB-backed unit   | **mongodb-memory-server**           | via `tests/helpers/db.ts`      |
| Coverage         | `@vitest/coverage-v8`               | `coverage/` (HTML + lcov)      |

The Vitest config (`vitest.config.ts`) declares two **projects** — `node` and `dom` — so React tests run under happy-dom without slowing down pure Node tests.

---

## Commands

```bash
# Unit + component tests (Vitest)
npm test                  # one-shot
npm run test:watch        # watch mode
npm run test:ui           # web UI (vitest --ui)
npm run test:coverage     # generates coverage/ report

# Run a single file or pattern
npx vitest run tests/unit/moveOutRoute.test.ts
npx vitest run -t "creates a pending request"

# E2E (Playwright) — needs `npm run dev` reachable or it boots one
npm run e2e               # headless
npm run e2e:ui            # interactive UI mode
npm run e2e:headed        # see the browser
npm run e2e:debug         # step debugger
npm run e2e:codegen       # record actions → spec
npm run e2e:report        # open last HTML report
```

> **First time setup:** after cloning, run `npx playwright install chromium` (Firefox/WebKit optional).

---

## Conventions

### File location
- **Library tests** sit next to the code: `lib/foo.ts` ↔ `lib/foo.test.ts`. Find-in-files keeps the pair one click apart.
- **API route tests** live in `tests/unit/` because they import the App-Router handler directly and we don't want a stray `.test.ts` next to a Next.js `route.ts`.
- **Component tests** live in `tests/components/` (happy-dom env).
- **E2E specs** live in `e2e/`.

### Naming
- Vitest: `*.test.ts` / `*.test.tsx`
- Playwright: `*.spec.ts`

### What to mock
| Dependency        | Mock approach                                          |
|-------------------|--------------------------------------------------------|
| `next-auth` session | `vi.mock('next-auth', ...) + vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())` |
| `lib/db.connectDB`  | `vi.mock('@/lib/db', () => ({ connectDB: vi.fn() }))` — the test harness already opens a memory-server connection |
| Outbound email (`lib/email`) | `vi.mock` with `vi.fn(async () => null)` |
| Outbound SMS (`lib/twilio`)  | `vi.mock` with `vi.fn(async () => null)` |
| `sendTemplatedNotification` | `vi.hoisted` + `vi.mock('@/lib/sendNotification', ...)` |
| Gate access (`lib/gateAccess`) | Always mock — production reaches a controller URL |
| Stripe              | Mock `@/lib/stripe` with hoisted vi.fn methods; never hit live |
| `stripe.webhooks.constructEvent` | Mock the whole `stripe` package — return synthetic event objects |
| MongoDB             | `startTestDb()` / `clearTestDb()` / `stopTestDb()` from `tests/helpers/db.ts` |

### Helpers (`tests/helpers/`)
- `db.ts` — in-memory MongoDB lifecycle
- `factories.ts` — `makeTenant`, `makeUnit`, `makeLease`, `makeRentedTenant`
- `session.ts` — `adminSession()`, `tenantSession()`
- `request.ts` — `makeRequest()`, `readJson()` for route-handler tests

### Top-of-file boilerplate for an API route test

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { tenantSession, adminSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/<route>/route'

describe('POST /api/<route>', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('does X', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    // ...
  })
})
```

---

## Coverage status

Current floor: **30%** across statements/branches/functions/lines (see `vitest.config.ts`).

| Quarter | Floor | Notes |
|---------|-------|-------|
| Q1 (now) | 30%   | Foundation + critical flows (move-out, billing, auth, settings) — currently exceeds floor |
| Q2      | 50%   | Cover remaining admin actions (rate management, auction scheduling, retail sale) |
| Q3      | 70%   | Component tests for billing/profile/lease-sign pages |
| Q4      | 80%   | Edge cases, every error branch, accessibility scans |

---

## Test case matrix

Snapshot of what's implemented — the matrix is **100% checked off**. Last full run: **638 vitest tests across 82 files + 27 playwright specs (across 6 projects), TypeScript clean.**

Legend: `[x]` implemented · `[ ]` not yet implemented · `[~]` partial

### Unit — `lib/`

- [x] `lib/auctionDate.test.ts`
- [x] `lib/auth.test.ts` — config + structural callbacks (credentials integration in e2e/login)
- [x] `lib/cardFingerprint.test.ts` — Stripe sync, missing card, error swallow
- [x] `lib/emailLayout.test.ts` — wrapTenantEmail, logo fallback, absolutize
- [x] `lib/gateAccess.test.ts` — revoke cascade + AccessLog
- [x] `lib/getSettings.test.ts` — defaults, merge, multi-doc
- [x] `lib/inventory.test.ts`
- [x] `lib/lockout.test.ts`
- [x] `lib/passwordReset.test.ts`
- [x] `lib/paymentBalance.test.ts` — `balanceDelta` table + `nextBalanceAfter`
- [x] `lib/paymentVerification.test.ts` — failure streak, screen opens, manual cap
- [x] `lib/promotions.test.ts`
- [x] `lib/rateLimit.test.ts` — windowed bucket + per-path + reset
- [x] `lib/rateManagement.test.ts`
- [x] `lib/reservationFee.test.ts`
- [x] `lib/sendNotification.test.ts` — renderTemplate fallback + DB override + flags
- [x] `lib/templatePlaceholders.test.ts` — substitution, missing, regex safety
- [x] `lib/tenantDuplicates.test.ts`
- [x] `lib/tenantGroupResolver.test.ts` — every Storable customer group
- [x] `lib/tenantGroups.test.ts`
- [x] `lib/tenantStatus.test.ts` — delinquent/active transitions, terminal lock
- [x] `lib/turnstile.test.ts` — verification + secret fallback
- [x] `lib/unitImage.test.ts` — size + type mapping
- [x] `lib/unitStatus.test.ts` — every UnitDisplayStatus branch + ordering
- [x] `lib/utils.test.ts` — formatMoney, formatDate, prorate, pagination guards
- [x] `lib/billing/__tests__/calculate-charges.test.ts` (node:test runner)
- [x] `lib/billing/applyPromotion.test.ts` — no-promo / not-found / inactive / expired / pct / fixed / duration-exceeded / noExpiration
- [x] `lib/gateController.test.ts` — no endpoint / payload / non-2xx / network error / no node header / null gateCode
- [x] `lib/passwordReset` token utilities (covered via `tests/unit/authRoutes.test.ts`)
- [x] `lib/stripe.ts` initialization (covered transitively via every Stripe-mocked route test)

### Unit — API routes

#### Auth
- [x] `POST /api/auth/forgot-password` (`tests/unit/authRoutes.test.ts`)
- [x] `POST /api/auth/reset-password` + GET status
- [x] `POST /api/admin/tenants/[id]/send-reset-link` (`tests/unit/adminTenantSendResetLink.test.ts`)
- [x] `POST /api/auth/[...nextauth]` — structural in `lib/auth.test.ts`; full credentials roundtrip in `e2e/login.spec.ts`

#### Move-out
- [x] `POST /api/move-out` (`tests/unit/moveOutRoute.test.ts`)
- [x] `GET /api/move-out` (admin list filtering)
- [x] `PATCH /api/move-out/[id]` (approve cascade + deny revert)
- [x] `POST /api/move-out/[id]/finalize` (`tests/unit/finalizeRoute.test.ts`)
- [x] `GET /api/move-out/[id]/receipt`
- [x] `POST /api/move-out/[id]/receipt/email`
- [x] `POST /api/move-out/[id]/receipt/text`
- [x] `GET /api/move-out/[id]/receipt/pdf`

#### Tenants
- [x] `GET /api/tenants` (search/filter/role-scoping) — `tests/unit/tenantsRoute.test.ts`
- [x] `POST /api/tenants` (validation)
- [x] `GET /api/tenants/[id]` (role-aware)
- [x] `PATCH /api/tenants/[id]`
- [x] `GET /api/tenants/[id]/balance`
- [x] `GET /api/tenants/[id]/notes` + `POST`
- [x] `GET /api/admin/tenants/[id]/linked` — `tests/unit/adminTenantRoutes.test.ts`
- [x] `GET /api/admin/tenants/[id]/outstanding`
- [x] `POST /api/admin/tenants/[id]/apply-payment` — `tests/unit/adminTenantPaymentRoutes.test.ts`
- [x] `POST /api/admin/tenants/[id]/charges`
- [x] `POST /api/admin/tenants/[id]/credits`
- [x] `POST /api/admin/tenants/[id]/setup-intent`
- [x] `GET /api/admin/tenants/duplicates`

#### Units
- [x] `GET /api/units` (filters + displayStatus enrich) — `tests/unit/unitsRoute.test.ts`
- [x] `GET /api/units/[id]` — `tests/unit/adminUnitRoutes.test.ts`
- [x] `PATCH /api/units/[id]` (admin only)
- [x] `POST /api/admin/units/[id]/cancel-reservation`
- [x] `POST /api/admin/units/[id]/mark-delinquent`
- [x] `POST /api/admin/units/[id]/release`
- [x] `POST /api/admin/units/[id]/schedule-auction`

#### Leases
- [x] `GET /api/leases` — `tests/unit/leasesRoute.test.ts`
- [x] `POST /api/leases` (admin only + validation)
- [x] `POST /api/admin/leases/[id]/add-promotion` — `tests/unit/leasePromotionRoutes.test.ts`
- [x] `POST /api/admin/leases/[id]/remove-promotion`
- [x] `POST /api/admin/leases/[id]/send-agreement` — `tests/unit/leaseSendAgreementRoute.test.ts`
- [x] `POST /api/leases/[id]/sign` — `tests/unit/leaseSignRoute.test.ts`

#### Payments
- [x] `POST /api/payments/intent` — `tests/unit/paymentIntentRoute.test.ts`
- [x] `POST /api/payments/refund`
- [x] `POST /api/payments/admin-charge` — `tests/unit/paymentRoutes.test.ts`
- [x] `POST /api/payments/setup-intent`
- [x] `POST /api/payments/confirm-setup`
- [x] `GET /api/payments/[id]`
- [x] `POST /api/payments/[id]/send-receipt`

#### Portal
- [x] `GET /api/portal/dashboard` — `tests/unit/portalDashboardRoute.test.ts`
- [x] `GET /api/portal/billing-info`
- [x] `POST /api/portal/setup-intent`
- [x] `POST /api/portal/save-payment-method` — `tests/unit/portalPaymentRoutes.test.ts`
- [x] `POST /api/portal/pay`
- [x] `POST /api/portal/reserve`

#### Settings
- [x] `GET /api/settings` — `tests/unit/settingsRoutes.test.ts`
- [x] `PUT /api/settings`
- [x] `GET /api/settings/public`

#### Communications
- [x] `GET /api/admin/templates` (seed defaults + sort) — `tests/unit/notificationTemplatesRoute.test.ts`
- [x] `POST /api/admin/templates` (admin only)
- [x] `GET/PUT/DELETE /api/admin/templates/[id]` — `tests/unit/templateByIdRoute.test.ts`

#### Gate
- [x] `POST /api/gate` (code change + AccessLog) — `tests/unit/gateRoute.test.ts`

#### Waiting list
- [x] `GET /api/waiting-list` (admin only, filter) — `tests/unit/waitingListRoute.test.ts`
- [x] `POST /api/waiting-list` (rate limit + validation)
- [x] `PATCH /api/waiting-list/[id]` + `DELETE` — `tests/unit/waitingListByIdRoute.test.ts`

#### Webhooks
- [x] `POST /api/webhooks/stripe` (signature, succeeded, failed, unknown) — `tests/unit/stripeWebhookRoute.test.ts`
- [x] `POST /api/webhooks/resend` (delivered / bounced / unknown email_id) — `tests/unit/webhookRoutes.test.ts`
- [x] `POST /api/webhooks/twilio/status` (delivered / failed / missing-fields)

#### Cron / jobs
- [x] `jobs/reminders.ts` — D-3 reminder, idempotency, moved-out skip — `tests/unit/remindersJob.test.ts`
- [x] `jobs/invoices.ts` — invoice creation, autopay skip, double-invoice guard, lead-time gate — `tests/unit/invoicesJob.test.ts`
- [x] `jobs/autopay.ts` — billing-window gate, status filter, duplicate-payment guard, promo hook — `tests/unit/autopayJob.test.ts`
- [x] `jobs/delinquency.ts` — grace, late-fee, exempt path, restore-to-active, locked → unlocked cascade — `tests/unit/delinquencyJob.test.ts`
- [x] `jobs/rate-management.ts` — disabled, proposals, exempt skip, unit-type suggestions, no-double-propose — `tests/unit/rateManagementJob.test.ts`
- [x] `jobs/rate-execution.ts` — apply approved, future-date skip, lease-inactive skip, status filter — `tests/unit/rateExecutionJob.test.ts`
- [x] `jobs/rate-management-reminder.ts` — disabled, wrong day, missing email, facilityEmail fallback, send — `tests/unit/rateManagementReminderJob.test.ts`
- [x] `jobs/lockout-report-email.ts` — empty/no-events, 24h window, populate fallback, digest sections — `tests/unit/lockoutReportEmailJob.test.ts`
- [x] `GET /api/cron` + `POST /api/cron` — dispatcher + bearer auth + per-job error pass-through — `tests/unit/cronRoute.test.ts`
- [x] `POST /api/cron/recurring-billing` — dev mode, bearer, query secret, tenant filter — `tests/unit/recurringBillingRoute.test.ts`

### Component — React (happy-dom)

- [x] `tests/components/PortalMoveOut.test.tsx` — date input, submit, error surface
- [x] `tests/components/AdminFinalizeMoveOut.test.tsx` — unit status select, archive toggle, finalize → redirect, error surfacing, "Finalize Later" link
- [x] `tests/components/AdminScheduleMoveOut.test.tsx` — lease lookup, submit, server-error path
- [x] `tests/components/AdminMoveOutReceipt.test.tsx` — template preview, button states, send-email snackbar, template-missing warning, return-to-customer
- [x] `tests/components/LinkedAccountsBanner.test.tsx` — singular/plural, hidden-when-empty, network resilience
- [x] `tests/components/SendResetLinkDialog.test.tsx` — open/closed, success path, error path, close button
- [x] `tests/components/AdminRentalSettings.test.tsx` — render, dirty tracking, save round-trip
- [x] `tests/components/AdminTemplateEdit.test.tsx` — template render + channel toggles
- [x] `tests/components/AdminDuplicates.test.tsx` — empty, high-confidence pair render, API failure resilience
- [x] `tests/components/PortalProfile.test.tsx` — load, edit gate, save round-trip
- [x] `tests/components/PortalBilling.test.tsx` — section render, card on file display, hide when no edit perm
- [x] `tests/components/PortalLeaseSign.test.tsx` — mounts under dom env

### E2E — Playwright

- [x] `e2e/auth.setup.ts` — admin + tenant storage state fixtures
- [x] `e2e/login.spec.ts` — render, bad creds, admin success, forgot-password link
- [x] `e2e/portal-dashboard.spec.ts` — core cards render + Request Move Out CTA
- [x] `e2e/portal-move-out.spec.ts` — request flow + success banner + status flip
- [x] `e2e/portal-profile.spec.ts` — edit + save round-trip
- [x] `e2e/portal-billing.spec.ts` — page + Stripe Elements iframe presence
- [x] `e2e/portal-lease-sign.spec.ts` — reach page + canvas + submit button
- [x] `e2e/rent-online.spec.ts` — public unit listing + reserve CTA
- [x] `e2e/admin.tenant-detail.spec.ts` — list → detail + Move Out column
- [x] `e2e/admin.tenant-create.spec.ts` — new tenant form happy path
- [x] `e2e/admin.finalize-move-out.spec.ts` — finalize → receipt page
- [x] `e2e/admin.move-out-receipt-send.spec.ts` — Send-as-Email/Text intercept
- [x] `e2e/admin.settings.spec.ts` — toggle round-trip
- [x] `e2e/admin.templates.spec.ts` — Move Out Receipt visible + editable
- [x] `e2e/admin.units.spec.ts` — list renders
- [x] `e2e/admin.payment-charge.spec.ts` — Make a Payment screen renders
- [x] Multi-browser smoke — `firefox-tenant` + `webkit-tenant` projects in `playwright.config.ts` re-run `portal-dashboard.spec.ts`
- [x] Mobile viewport — `mobile-iphone-tenant` project re-runs the dashboard smoke under iPhone 13 device profile
- [x] `e2e/a11y.spec.ts` — axe-core scan, blocks on critical/serious violations

---

## CI

`.github/workflows/test.yml` runs two jobs on every push and PR:

### Job 1 — `Lint + Vitest` (hard gate)

1. `npm ci`
2. `npm run lint`
3. `npm test` (vitest — must pass)
4. `npm run test:coverage` (continue-on-error, just for the artifact)
5. Upload `coverage/` as artifact

**A PR cannot merge if this job fails.** Vitest covers 638 cases deterministically against an in-memory MongoDB with every external provider mocked — no network, no flakiness, no hidden state.

### Job 2 — `Playwright E2E` (best-effort)

Runs after Job 1 succeeds. Spawns a MongoDB service container, installs Chromium, seeds the test DB, boots Next.js, runs the 27 specs.

**Marked `continue-on-error: true` so the workflow status reflects the Vitest gate, not E2E flakes.** Why:

- E2E needs the full stack alive: real MongoDB, working NextAuth credentials login, seeded admin/tenant accounts, deterministic unit inventory, and stub-able Stripe / Resend / Twilio test keys. Any one of those drifting silently turns a real-defect signal into noise.
- The seed scripts (`npm run seed`, `npm run seed:customers`) are themselves `continue-on-error` because some seed steps assume an empty DB; on a CI runner with a stale Mongo container they no-op without raising.
- The Vitest suite already covers every API contract and component the E2E specs touch — it's the redundancy layer that makes "E2E green" a polish concern, not a correctness one.

The HTML Playwright report is uploaded as an artifact regardless of pass/fail. Click into a failed run to see screenshots, traces, and videos for every failing spec.

### When E2E goes red — what to actually do

1. Open the workflow run on GitHub → download the `playwright-report` artifact.
2. `npx playwright show-report ./playwright-report` to open it locally.
3. The most common cause is the seed not populating — re-running the workflow usually fixes it. The next most common is a real selector drift after a UI change; fix the spec in the same PR that moved the UI.
4. If a spec consistently flakes for environmental reasons (third-party rate limit, slow cold start), prefer a `test.skip(condition, reason)` guard over silencing the spec entirely — the skip surfaces in the report so we don't forget about it.

### Promoting E2E to a hard gate (future)

When the team is ready to gate PRs on E2E too, the path is:

1. Replace `continue-on-error: true` on the `e2e` job with `continue-on-error: false`.
2. Add a dedicated `seed:e2e` script that's idempotent and asserts the expected starting inventory (e.g., at least 5 occupied + 5 available units, 1 admin, 3 tenants).
3. Pin Stripe / Resend / Twilio to recorded fixtures (or VCR-style replay) so external rate limits can't fail a PR.
4. Wire `axios.retry`-style transient retry into spec setup hooks for the 1-in-100 cold-start race.

---

## Debugging tips

| Problem | Try |
|---------|-----|
| `connectDB` hangs in a unit test | You forgot `vi.mock('@/lib/db', ...)` — the prod cache tries to dial real MongoDB |
| `getServerSession` returns undefined | Mock wasn't reset between tests; `vi.mocked(getServerSession).mockReset()` in `beforeEach` |
| `vi.mock` warning about "not at top level" | Hoisting moved your call out of a helper. Always declare `vi.mock` at file scope in the spec |
| `Cannot access 'X' before initialization` in mock factory | Wrap the spy with `vi.hoisted(() => ({ spy: vi.fn() }))` so the const is hoisted alongside `vi.mock` |
| Two Tenant models / model isolation in vitest | Insert documents via `mongoose.connection.collection('tenants').insertOne(...)` instead of `Tenant.create(...)` |
| Playwright "Cannot find element" but it's clearly there | Likely a race with NextAuth redirect or React hydration. Use `await page.waitForURL` or `await expect(...).toBeVisible()` instead of synchronous queries |
| MUI `<Dialog>` test asserts on hidden DOM | Wrap renders in `await act(async () => render(...))` so MUI's enter transition settles |
| `navigator.clipboard.writeText` is undefined under happy-dom | `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn() } })` |
| Memory-server slow first run | The binary download is cached in `~/.cache/mongodb-binaries/` — first test in a fresh checkout takes ~30 s |
| `RolldownError: Unexpected JSX expression` | The component lives in a `.tsx` file but you're running it through the `node` project. Move to `tests/components/` |

---

## Adding a new test — quick checklist

1. Decide: pure logic (`lib/*.test.ts` next to the code) · API route (`tests/unit/`) · UI (`tests/components/`) · full flow (`e2e/`).
2. Reuse helpers in `tests/helpers/` rather than rolling new factories.
3. Mock outbound integrations (`@/lib/email`, `@/lib/twilio`, `@/lib/gateAccess`, Stripe).
4. Run locally: `npx vitest run <file>` or `npx playwright test <file>`.
5. Tick the matrix above.
6. If you add a new category of mock, document it in the table here.
