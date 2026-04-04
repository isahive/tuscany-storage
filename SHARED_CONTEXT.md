# SHARED_CONTEXT.md
# Tuscany Village Self Storage — Master Project Context
# READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE

---

## Project Overview

Full-stack self-storage management platform replacing Storable Easy.
One week delivery. Two developers working in parallel on the same monorepo.

**Live URL:** tuscanystorage.com
**Hosting:** Single Render Web Service (one server, one deploy)
**Stack:** Next.js 14 App Router · MongoDB + Mongoose · NextAuth.js · Stripe · MUI (dashboards only) · Tailwind (public site only)

---

## Monorepo Structure — EXACT, DO NOT DEVIATE

```
tuscany/
├── app/
│   ├── (public)/                  # Public website — Tailwind only
│   │   ├── page.tsx               # Home
│   │   ├── units/
│   │   │   ├── page.tsx           # Units listing
│   │   │   └── [slug]/page.tsx    # Individual unit
│   │   ├── contact/page.tsx
│   │   ├── how-it-works/page.tsx
│   │   ├── size-guide/page.tsx
│   │   └── waiting-list/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── portal/                    # Tenant portal — MUI
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard
│   │   ├── payments/page.tsx
│   │   ├── gate-code/page.tsx
│   │   └── move-out/page.tsx
│   ├── admin/                     # Operator admin — MUI
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard / KPIs
│   │   ├── tenants/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── units/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── delinquency/page.tsx
│   │   ├── rate-management/page.tsx
│   │   ├── waiting-list/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── tenants/
│       │   ├── route.ts            # GET (list) · POST (create)
│       │   └── [id]/
│       │       ├── route.ts        # GET · PATCH · DELETE
│       │       └── gate-code/route.ts
│       ├── units/
│       │   ├── route.ts            # GET (list) · POST (create)
│       │   └── [id]/route.ts       # GET · PATCH · DELETE
│       ├── leases/
│       │   ├── route.ts            # GET · POST
│       │   └── [id]/
│       │       ├── route.ts        # GET · PATCH
│       │       └── sign/route.ts   # POST — e-sign
│       ├── payments/
│       │   ├── route.ts            # GET (history) · POST (one-time)
│       │   ├── intent/route.ts     # POST — Stripe PaymentIntent
│       │   └── webhook/route.ts    # POST — Stripe webhook
│       ├── waiting-list/
│       │   ├── route.ts            # GET · POST
│       │   └── [id]/route.ts       # DELETE
│       ├── notifications/
│       │   └── route.ts            # POST — send manual notification
│       ├── gate/
│       │   └── route.ts            # POST — update gate code
│       ├── admin/
│       │   ├── dashboard/route.ts  # GET — KPI stats
│       │   ├── move-in/route.ts    # POST — full move-in flow
│       │   └── move-out/route.ts   # POST — move-out flow
│       └── webhooks/
│           └── stripe/route.ts     # POST — Stripe events
├── components/
│   ├── public/                    # Tailwind components
│   ├── portal/                    # MUI components (tenant)
│   ├── admin/                     # MUI components (operator)
│   └── shared/                    # Framework-agnostic utilities
├── lib/
│   ├── db.ts                      # Mongoose connection
│   ├── auth.ts                    # NextAuth config (exported as authOptions)
│   ├── stripe.ts                  # Stripe client singleton
│   ├── twilio.ts                  # Twilio client singleton
│   ├── sendgrid.ts                # SendGrid client singleton
│   ├── pdf.ts                     # PDF generation (PDFKit)
│   └── utils.ts                   # Shared utilities
├── models/
│   ├── Tenant.ts
│   ├── Unit.ts
│   ├── Lease.ts
│   ├── Payment.ts
│   ├── AccessLog.ts
│   ├── Notification.ts
│   └── WaitingList.ts
├── jobs/
│   ├── autopay.ts                 # Daily autopay cron
│   ├── reminders.ts               # D-3 payment reminders
│   ├── delinquency.ts             # Mora escalation
│   └── rate-management.ts         # Rate increase automation
├── types/
│   └── index.ts                   # All shared TypeScript types
├── public/
│   └── manifest.json              # PWA manifest
├── middleware.ts                  # Auth route protection
├── next.config.ts
├── tailwind.config.ts
└── .env.local                     # NEVER commit this
```

---

## Environment Variables — EXACT NAMES, NO VARIATIONS

```bash
# Database
MONGODB_URI=

# Auth
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Stripe
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# App
NEXT_PUBLIC_APP_URL=
ADMIN_EMAIL=
```

---

## MongoDB Models — CANONICAL, DO NOT CHANGE FIELD NAMES

### Tenant
```typescript
{
  _id: ObjectId,
  // Personal info
  firstName: string,          // required
  lastName: string,           // required
  email: string,              // required, unique
  phone: string,              // required
  alternatePhone?: string,
  alternateEmail?: string,
  address?: string,
  city?: string,
  state?: string,
  zip?: string,
  driversLicense?: string,
  // Auth
  password: string,           // hashed with bcrypt
  role: 'tenant' | 'admin',   // default: 'tenant'
  // Gate
  gateCode?: string,
  // Stripe
  stripeCustomerId?: string,
  defaultPaymentMethodId?: string,
  autopayEnabled: boolean,    // default: false
  // Status
  status: 'active' | 'delinquent' | 'locked_out' | 'moved_out',
  // SMS consent
  smsOptIn: boolean,          // default: false
  // Referral
  referralSource?: string,
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
}
```

### Unit
```typescript
{
  _id: ObjectId,
  unitNumber: string,         // e.g. "14B" — required, unique
  size: string,               // e.g. "10x10"
  width: number,              // feet
  depth: number,              // feet
  sqft: number,               // calculated: width * depth
  type: 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor',
  floor: 'ground' | 'upper',
  price: number,              // monthly rate in cents (always store money in cents)
  status: 'available' | 'occupied' | 'maintenance' | 'reserved',
  features: string[],         // e.g. ["Drive-up access", "LED lighting"]
  currentTenantId?: ObjectId, // ref: Tenant
  currentLeaseId?: ObjectId,  // ref: Lease
  notes?: string,
  createdAt: Date,
  updatedAt: Date,
}
```

### Lease
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,         // ref: Tenant — required
  unitId: ObjectId,           // ref: Unit — required
  // Dates
  startDate: Date,            // required
  endDate?: Date,             // null = month-to-month
  moveOutDate?: Date,         // set when tenant gives notice
  // Financial
  monthlyRate: number,        // in cents — locked at lease start
  deposit: number,            // in cents
  proratedFirstMonth: number, // in cents — calculated at move-in
  billingDay: number,         // 1-28, day of month rent is due
  // Status
  status: 'active' | 'ended' | 'pending_moveout',
  // E-sign
  leaseDocumentUrl?: string,  // S3 or local path to PDF
  signedAt?: Date,
  signatureData?: string,     // base64 canvas signature
  // Rate changes
  lastRateChangeDate?: Date,
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
}
```

### Payment
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,         // ref: Tenant — required
  leaseId: ObjectId,          // ref: Lease — required
  unitId: ObjectId,           // ref: Unit — required
  // Stripe
  stripePaymentIntentId: string,
  stripeChargeId?: string,
  // Amount
  amount: number,             // in cents
  currency: 'usd',
  // Type
  type: 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'other',
  // Status
  status: 'pending' | 'succeeded' | 'failed' | 'refunded',
  // Period
  periodStart: Date,          // what month this payment covers
  periodEnd: Date,
  // Retry tracking
  attemptCount: number,       // default: 0
  lastAttemptAt?: Date,
  failureReason?: string,
  // Receipt
  receiptUrl?: string,
  receiptEmailSentAt?: Date,
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
}
```

### AccessLog
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,         // ref: Tenant — required
  unitId?: ObjectId,          // ref: Unit
  // Event
  eventType: 'entry' | 'exit' | 'denied' | 'code_changed',
  gateId: 'entrance' | 'exit' | 'unknown',
  // Source
  source: 'keypad' | 'app' | 'admin' | 'system',
  // Metadata
  ipAddress?: string,
  notes?: string,
  // Timestamps
  createdAt: Date,            // this IS the event timestamp
}
```

### Notification
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,         // ref: Tenant — required
  // Content
  type: 'payment_reminder' | 'payment_confirmation' | 'payment_failed' |
        'late_notice' | 'lockout_notice' | 'gate_code_changed' |
        'move_in_confirmation' | 'move_out_confirmation' |
        'rate_change_notice' | 'waiting_list_available' | 'custom',
  channel: 'email' | 'sms' | 'both',
  subject?: string,           // email only
  body: string,
  // Status
  status: 'pending' | 'sent' | 'failed' | 'undelivered',
  sentAt?: Date,
  failureReason?: string,
  // External IDs
  twilioMessageSid?: string,
  sendgridMessageId?: string,
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
}
```

### WaitingList
```typescript
{
  _id: ObjectId,
  // Contact (can be non-tenant)
  name: string,               // required
  email: string,              // required
  phone: string,              // required
  // Preference
  preferredSize: string,      // e.g. "10x10"
  preferredType?: string,
  desiredMoveInDate?: Date,
  notes?: string,
  // Status
  status: 'waiting' | 'notified' | 'converted' | 'expired',
  notifiedAt?: Date,
  notifiedUnitId?: ObjectId,  // ref: Unit
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
}
```

---

## Auth — NextAuth Configuration

**File:** `lib/auth.ts` — export as `authOptions`

```typescript
// JWT contains:
{
  id: string,          // tenant._id as string
  email: string,
  role: 'tenant' | 'admin',
  name: string,        // firstName + " " + lastName
}
```

**Route protection via middleware.ts:**
- `/portal/*` → requires role: 'tenant' OR 'admin'
- `/admin/*` → requires role: 'admin' ONLY
- `/api/admin/*` → requires role: 'admin' ONLY
- `/api/tenants/*` → tenant can only access own data; admin can access all
- Public routes: everything under `(public)`, `/login`, `/register`, `/api/webhooks/*`

**Session strategy:** JWT (not database sessions)

---

## API Conventions — STRICT

### Response format — ALL API routes return this shape:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string, code?: string }
```

### HTTP status codes:
- 200 — OK
- 201 — Created
- 400 — Bad request / validation error
- 401 — Not authenticated
- 403 — Authenticated but not authorized
- 404 — Not found
- 500 — Server error

### Money: ALWAYS in cents (integer). Never floats. Never strings.
- Store: `price: 10000` = $100.00
- Display: `(price / 100).toFixed(2)`

### Dates: ALWAYS ISO strings in API responses. Native Date in DB.

### Pagination: all list endpoints accept `?page=1&limit=20`

---

## Styling Rules — NO MIXING

| Area | Framework | Notes |
|---|---|---|
| Public website | Tailwind only | No MUI imports whatsoever |
| Tenant portal | MUI only | No Tailwind utility classes |
| Admin panel | MUI only | No Tailwind utility classes |
| Shared logic | Framework-agnostic | Pure TypeScript |

**MUI Theme** (both portal and admin use same theme — defined in `lib/theme.ts`):
```typescript
primary: { main: '#B8914A' }    // Tuscany tan
secondary: { main: '#1C0F06' }  // Tuscany brown
background: { default: '#FAF7F2' }
```

---

## Cron Jobs — Register in `app/api/cron/route.ts`

Render doesn't have built-in cron — use a startup file or external ping.
All jobs live in `/jobs/` and are imported + scheduled with `node-cron`.

| Job | Schedule | File |
|---|---|---|
| Autopay | Daily 8am EST | `jobs/autopay.ts` |
| Payment reminders | Daily 9am EST | `jobs/reminders.ts` |
| Delinquency escalation | Daily 10am EST | `jobs/delinquency.ts` |
| Rate management | 1st of month 7am EST | `jobs/rate-management.ts` |

---

## Critical Rules — Both Devs Must Follow

1. **Never use `any` in TypeScript.** Define types in `types/index.ts`.
2. **Never store money as float.** Always cents as integer.
3. **Never commit `.env.local`.** It's in `.gitignore`.
4. **Never create a model file that another dev is responsible for.** See ownership below.
5. **Always validate request body** before touching the DB. Use `zod`.
6. **Always use the singleton pattern** for DB, Stripe, Twilio, SendGrid connections in `lib/`.
7. **Always handle Stripe webhook signature verification** before processing any event.
8. **Never send SMS or email in a synchronous API route** — queue via the Notification model and let the job process it, OR use `Promise` without await for fire-and-forget.
9. **All dates stored in UTC** in MongoDB. Convert to local on the client.
10. **Git: each dev works on their own branch.** Dev 1: `dev/backend`. Dev 2: `dev/frontend`. Merge to `main` only after daily sync.

---

## File Ownership — WHO BUILDS WHAT

### Dev 1 owns:
- All `models/` files
- All `lib/` files
- All `jobs/` files
- All `app/api/` routes
- `middleware.ts`
- `next.config.ts`
- Database seeding scripts

### Dev 2 owns:
- All `app/(public)/` pages and components
- All `app/portal/` pages and components
- All `app/admin/` pages and components
- All `components/` directories
- `lib/theme.ts` (MUI theme)
- `public/manifest.json`
- `tailwind.config.ts`

### Shared ownership (coordinate before touching):
- `types/index.ts` — add types, never remove
- `package.json` — communicate before adding dependencies
- `app/layout.tsx` — root layout, touch carefully

---

## Package Versions — Pin These

```json
{
  "next": "14.2.x",
  "react": "18.x",
  "mongoose": "8.x",
  "next-auth": "4.x",
  "stripe": "14.x",
  "@mui/material": "5.x",
  "@mui/icons-material": "5.x",
  "@emotion/react": "11.x",
  "@emotion/styled": "11.x",
  "zod": "3.x",
  "bcryptjs": "2.x",
  "node-cron": "3.x",
  "pdfkit": "0.15.x",
  "twilio": "5.x",
  "@sendgrid/mail": "8.x",
  "next-pwa": "5.x"
}
```

---

## Delinquency Flow — Business Logic

This is the exact flow. Do not invent your own.

```
Day 0   — Payment due (billingDay of month)
Day 1   — Grace period begins
Day 5   — LATE: status → 'delinquent', late fee added, email + SMS sent
Day 10  — LOCKED OUT: status → 'locked_out', gate access revoked, email + SMS sent
Day 30  — Pre-lien notice sent (email + SMS + print)
Day 45  — Lien notice sent
Day 60  — Auction process begins (manual admin action)

Payment received at any stage → status back to 'active', access restored immediately
```

---

## Rate Management Logic

```
Trigger conditions (BOTH must be true):
  1. Unit occupancy >= 90% for that unit type
  2. Tenant has been in unit >= 12 months without a rate change

Increase amount: 5% rounded up to nearest dollar
Notice: 30 days advance notice by email + SMS
Admin must approve the batch before it executes
```

---

## Stripe Integration Notes

- **Recurring payments:** Use `PaymentIntent` with `setup_future_usage: 'off_session'` + saved `PaymentMethod`. Do NOT use Stripe Subscriptions — we handle billing logic ourselves for flexibility.
- **Webhooks to handle:**
  - `payment_intent.succeeded` → update Payment status, send receipt
  - `payment_intent.payment_failed` → update Payment status, increment attemptCount, trigger retry logic
  - `customer.updated` → sync customer data
- **Always verify webhook signature** using `STRIPE_WEBHOOK_SECRET`

---

## PWA Setup

`next-pwa` wraps Next.js. Configure in `next.config.ts`:
```typescript
const withPWA = require('next-pwa')({ dest: 'public', disable: process.env.NODE_ENV === 'development' })
```

`public/manifest.json` must include:
- `name`: "Tuscany Village Storage"
- `short_name`: "TuscanyStorage"
- `theme_color`: "#1C0F06"
- `background_color`: "#FAF7F2"
- Push notifications via Web Push API (VAPID keys in env)

---

## QuickBooks Integration

Use the native **Stripe → QuickBooks** integration via Stripe Apps marketplace.
No custom code needed — the operator connects their QBO account in the Stripe dashboard.
If the client wants deeper sync (custom reports, unit-level P&L), that goes in a future phase.

---

## Data Migration (Dev 1 responsibility)

Script at `scripts/migrate.ts`:
- Input: Storable CSV export (tenants + units)
- Maps Storable fields to our Mongoose models
- Creates Stripe customers for all active tenants
- Preserves payment history as `Payment` documents with `status: 'succeeded'`
- Idempotent — safe to run multiple times
- Run: `npx ts-node scripts/migrate.ts --file=export.csv --dry-run`

---

## Git Workflow

```bash
# Dev 1
git checkout -b dev/backend

# Dev 2  
git checkout -b dev/frontend

# Daily sync — both devs do this at end of day
git fetch origin
git merge origin/main
# resolve conflicts in types/index.ts and package.json together

# Push to main only after both devs confirm no conflicts
git checkout main
git merge dev/backend
git merge dev/frontend
git push origin main  # triggers Render auto-deploy
```

---

## Render Deployment

- **Service type:** Web Service
- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Node version:** 20.x
- **Auto-deploy:** Yes, on push to `main`
- All env vars set in Render dashboard — never in code
