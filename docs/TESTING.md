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
| Gate access (`lib/gateAccess`) | Always mock — production reaches a controller URL |
| Stripe              | Use `@stripe/stripe-js` test keys; never hit live |
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

## Coverage targets

Current floor: **30%** across statements/branches/functions/lines (see `vitest.config.ts`).

Roadmap (raise as the matrix below gets checked off):

| Quarter | Floor | Notes |
|---------|-------|-------|
| Q1 (now) | 30%   | Foundation + critical flows (move-out, billing, auth) |
| Q2      | 50%   | All API routes covered, all lib functions ≥ 1 test |
| Q3      | 70%   | Component tests for major admin/portal pages |
| Q4      | 80%   | Edge cases, error branches |

---

## Test case matrix

> Legend: `[x]` implemented · `[ ]` pending · `[~]` partial

### Unit — `lib/`

#### Already implemented (pre-existing)
- [x] `lib/auctionDate.test.ts`
- [x] `lib/inventory.test.ts`
- [x] `lib/lockout.test.ts`
- [x] `lib/promotions.test.ts`
- [x] `lib/rateManagement.test.ts`
- [x] `lib/reservationFee.test.ts`
- [x] `lib/tenantGroups.test.ts`
- [x] `lib/tenantDuplicates.test.ts`
- [x] `lib/passwordReset.test.ts`
- [x] `lib/billing/__tests__/calculate-charges.test.ts` (node:test runner)

#### Move-out (newly added)
- [x] `tests/unit/sendNotification.test.ts` — `renderTemplate()` DB priority + fallback + placeholders + flags
- [x] `tests/unit/moveOutRoute.test.ts` — POST /api/move-out auth, lease cascade, duplicate, admin-on-behalf, validation
- [x] `tests/unit/finalizeRoute.test.ts` — POST /api/move-out/[id]/finalize role gating, archive flag, unit status, denied state

#### Pending (priority order)
- [ ] `lib/sendNotification.ts` — `sendTemplatedNotification` channels filter + Notification row creation
- [ ] `lib/templatePlaceholders.ts` — placeholder substitution edge cases (missing keys, [[CAPS]] vs camelCase)
- [ ] `lib/emailLayout.ts` — `wrapTenantEmail` with custom + default logo
- [ ] `lib/getSettings.ts` — singleton creation, defaults
- [ ] `lib/utils.ts` — `formatMoney`, `formatDate`, format helpers
- [ ] `lib/stripeFees.ts` — fee calculation per amount tier
- [ ] `lib/gateAccess.ts` — revoke flow + audit log entry
- [ ] `lib/autopay.ts` — charge attempts, failure handling
- [ ] `lib/billing/calculate-prorate.ts` — every proration model in Settings
- [ ] `lib/protectionPlans.ts`
- [ ] `lib/auth.ts` — NextAuth credentials provider verify
- [ ] `lib/r2.ts` — presign URL generation

### Unit — API routes

#### Auth
- [ ] `POST /api/auth/[...nextauth]` — credentials login success + failure
- [ ] `POST /api/auth/register` — duplicate email rejection
- [ ] `POST /api/auth/forgot-password` — link generation + rate limit
- [ ] `POST /api/auth/reset-password` — token expiry, password update

#### Move-out (newly added)
- [x] `POST /api/move-out` (`tests/unit/moveOutRoute.test.ts`)
- [x] `POST /api/move-out/[id]/finalize` (`tests/unit/finalizeRoute.test.ts`)
- [ ] `GET /api/move-out` — admin filter by status + tenantId
- [ ] `PATCH /api/move-out/[id]` — approve cascade, deny revert
- [ ] `GET /api/move-out/[id]/receipt` — rendered template payload shape
- [ ] `POST /api/move-out/[id]/receipt/email` — dispatches via sendTemplatedNotification email channel
- [ ] `POST /api/move-out/[id]/receipt/text` — dispatches SMS channel
- [ ] `GET /api/move-out/[id]/receipt/pdf` — returns valid PDF buffer + headers

#### Tenants
- [ ] `GET /api/tenants` — pagination, search, sort
- [ ] `GET /api/tenants/[id]` — populated lease + balance
- [ ] `PATCH /api/tenants/[id]` — field validation
- [ ] `GET /api/tenants/[id]/balance` — outstanding/credit math
- [ ] `GET /api/tenants/[id]/notes` + `POST` — note CRUD
- [ ] `POST /api/admin/tenants/[id]/reset-password` — admin issues reset link

#### Units
- [ ] `GET /api/units` — filter by status/type/size
- [ ] `POST /api/units` — admin create with required fields
- [ ] `PATCH /api/units/[id]` — status transitions

#### Leases
- [ ] `GET /api/leases` — filter by tenantId
- [ ] `POST /api/admin/leases/[id]/add-promotion` + `remove-promotion`
- [ ] `POST /api/admin/leases/[id]/send-agreement` — email dispatch

#### Payments
- [ ] `POST /api/payments/intent` — Stripe PaymentIntent creation
- [ ] `POST /api/payments/charge` — off-session charge by admin
- [ ] `POST /api/payments/webhook` — Stripe event handling (succeeded, failed, refund)
- [ ] `POST /api/payments/[id]/refund` — partial + full refund
- [ ] `POST /api/payments/[id]/void` — void unpaid line item

#### Portal
- [ ] `GET /api/portal/dashboard` — composite payload (contact, balance, rentals, billing)
- [ ] `GET /api/portal/billing-info` — Stripe pm fetch
- [ ] `POST /api/portal/setup-intent` — SetupIntent creation
- [ ] `POST /api/portal/save-payment-method` — Stripe attach + default pm
- [ ] `POST /api/portal/autopay` — toggle + initial charge

#### Settings
- [ ] `GET /api/settings` — auth required
- [ ] `PUT /api/settings` — admin role required + validation
- [ ] `GET /api/settings/public` — no auth, filtered subset

#### Communications
- [ ] `GET /api/notification-templates` — list with seeded defaults
- [ ] `PUT /api/notification-templates/[id]` — admin edits

#### Cron / jobs
- [ ] `jobs/billing.ts` — recurring rent invoicing
- [ ] `jobs/delinquency.ts` — late fee + lockout transitions
- [ ] `jobs/autopay.ts` — autopay capture
- [ ] `jobs/notifications.ts` — late/lien fan-out

### Component — React

#### Newly added
- [x] `tests/components/PortalMoveOut.test.tsx` — date input, submit, error surface

#### Pending (admin)
- [ ] `app/admin/tenants/[id]/finalize-move-out/page.tsx` — unit status select, archive toggle, finalize → redirect
- [ ] `app/admin/tenants/[id]/schedule-move-out/page.tsx` — admin schedules on behalf
- [ ] `app/admin/tenants/[id]/move-out-receipt/page.tsx` — template preview, button states based on email/text flags
- [ ] `app/admin/settings/rental/page.tsx` — dirty tracking, save, all toggles
- [ ] `app/admin/communications/templates/[id]/page.tsx` — placeholder insertion, save
- [ ] `app/admin/tenants/duplicates/page.tsx` — merge dialog
- [ ] `components/admin/LinkedAccountsBanner.tsx`
- [ ] `components/admin/SendResetLinkDialog.tsx`

#### Pending (portal)
- [ ] `app/portal/billing/page.tsx` — Stripe CardElement, autopay toggle
- [ ] `app/portal/profile/page.tsx` — edit guarded by setting
- [ ] `app/portal/lease/sign/page.tsx` — signature pad + submit
- [ ] `app/portal/page.tsx` — banner permutations (agreement, locked, moveout success)

### E2E — Playwright

#### Newly added
- [x] `e2e/auth.setup.ts` — admin + tenant storage state
- [x] `e2e/portal-dashboard.spec.ts` — smoke
- [x] `e2e/portal-move-out.spec.ts` — request + banner + status
- [x] `e2e/admin.tenant-detail.spec.ts` — list → detail navigation
- [x] `e2e/admin.finalize-move-out.spec.ts` — finalize → receipt page

#### Pending (critical paths)
- [ ] `e2e/login.spec.ts` — invalid creds, locked account, redirects
- [ ] `e2e/portal-billing.spec.ts` — add card → autopay → mock Stripe test card
- [ ] `e2e/portal-profile.spec.ts` — edit + saves
- [ ] `e2e/portal-lease-sign.spec.ts` — full agreement signature flow
- [ ] `e2e/rent-online.spec.ts` — public unit listing → reserve → checkout
- [ ] `e2e/admin.tenant-create.spec.ts` — create tenant + assign unit
- [ ] `e2e/admin.payment-charge.spec.ts` — admin charges off-session
- [ ] `e2e/admin.settings.spec.ts` — rental settings save round-trip
- [ ] `e2e/admin.templates.spec.ts` — edit Move Out Receipt template + verify preview
- [ ] `e2e/admin.units.spec.ts` — create/edit/delete unit
- [ ] `e2e/admin.move-out-receipt-send.spec.ts` — Send as Email / Text / PDF (mock provider stubs)

#### Pending (regression)
- [ ] Multi-browser smoke (Firefox, WebKit) for portal dashboard
- [ ] Mobile viewport smoke (iPhone 13)
- [ ] Accessibility scan with `@axe-core/playwright`

---

## CI

`.github/workflows/test.yml` runs on every push and PR:

1. `npm ci`
2. `npm run lint`
3. `npm test` (vitest)
4. `npx playwright install --with-deps chromium`
5. `npm run e2e` (against a freshly-spawned dev server)

The Playwright HTML report is uploaded as an artifact on failure. PRs cannot merge until all three steps pass.

---

## Debugging tips

| Problem | Try |
|---------|-----|
| `connectDB` hangs in a unit test | You forgot `vi.mock('@/lib/db', ...)` — the prod cache tries to dial real MongoDB |
| `getServerSession` returns undefined | Mock wasn't reset between tests; `vi.mocked(getServerSession).mockReset()` in `beforeEach` |
| `vi.mock` warning about "not at top level" | Hoisting moved your call out of a helper. Always declare `vi.mock` at file scope in the spec |
| Playwright "Cannot find element" but it's clearly there | Likely a race with NextAuth redirect or React hydration. Use `await page.waitForURL` or `await expect(...).toBeVisible()` instead of synchronous queries |
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
