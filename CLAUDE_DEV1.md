# CLAUDE_DEV1.md
# Tuscany Village Self Storage — Dev 1 (Backend)
# READ SHARED_CONTEXT.md FIRST. THEN READ THIS FILE. THEN START CODING.

---

## Your Role

You are Dev 1. You own the entire backend of this project:
- MongoDB models (Mongoose)
- All API routes (Next.js App Router)
- Authentication (NextAuth.js)
- Stripe integration
- Twilio + SendGrid
- Cron jobs
- PDF generation
- Data migration script
- Middleware

Dev 2 is building the UI simultaneously. They will call your API endpoints.
Your job is to make those endpoints solid, well-typed, and consistent.

---

## Day-by-Day Plan

### Day 1 — Foundation

**Goal: Everything compiles, deploys to Render, and DB connects.**

1. Init Next.js 14 project with TypeScript and App Router
   ```bash
   npx create-next-app@14 tuscany --typescript --app --no-tailwind --no-src-dir
   ```

2. Install all dependencies immediately so Dev 2 can install and run:
   ```bash
   npm install mongoose next-auth @auth/mongoose-adapter bcryptjs stripe twilio @sendgrid/mail pdfkit node-cron zod @mui/material @mui/icons-material @emotion/react @emotion/styled next-pwa
   npm install -D @types/bcryptjs @types/pdfkit ts-node
   ```

3. Create `.env.local` template (commit only the template with empty values):
   ```
   MONGODB_URI=
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=
   STRIPE_PUBLISHABLE_KEY=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_PHONE_NUMBER=
   SENDGRID_API_KEY=
   SENDGRID_FROM_EMAIL=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ADMIN_EMAIL=
   ```

4. Build in this order:
   - `lib/db.ts` — Mongoose singleton connection
   - `lib/auth.ts` — NextAuth config with credentials provider
   - `lib/stripe.ts` — Stripe singleton
   - `lib/twilio.ts` — Twilio singleton
   - `lib/sendgrid.ts` — SendGrid singleton
   - `types/index.ts` — All TypeScript interfaces
   - All 7 models in `models/`
   - `middleware.ts` — Route protection
   - `app/api/auth/[...nextauth]/route.ts`

5. Seed script `scripts/seed.ts` with:
   - 1 admin user (email: admin@tuscanystorage.com, password: admin123)
   - 6 sample units (5x10, 10x10 x2, 10x15, 10x20, 10x30)
   - 3 sample tenants with active leases

6. Deploy to Render — confirm it boots with no errors before EOD.

---

### Day 2 — Stripe + Payments API

**Goal: Full payment flow working end to end.**

Build in this order:

1. **`app/api/tenants/route.ts`** — GET (list with pagination + filters) · POST (create)
2. **`app/api/tenants/[id]/route.ts`** — GET · PATCH · DELETE
3. **`app/api/units/route.ts`** — GET (list, filter by status/type/size) · POST
4. **`app/api/units/[id]/route.ts`** — GET · PATCH · DELETE
5. **`app/api/payments/intent/route.ts`** — POST — creates Stripe PaymentIntent
   ```typescript
   // Request body
   { leaseId: string, amount: number, type: PaymentType, saveCard: boolean }
   // Response
   { success: true, data: { clientSecret: string, paymentIntentId: string } }
   ```
6. **`app/api/payments/route.ts`** — GET (history for tenant or all) · POST (record payment)
7. **`app/api/webhooks/stripe/route.ts`** — Handle these events:
   - `payment_intent.succeeded` → update Payment.status, trigger receipt email
   - `payment_intent.payment_failed` → update Payment.status, increment attemptCount
8. **`app/api/admin/move-in/route.ts`** — Full move-in flow:
   ```typescript
   // POST body
   { tenantId: string, unitId: string, startDate: string, paymentMethodId?: string }
   // This route must:
   // 1. Create Lease document
   // 2. Update Unit.status to 'occupied'
   // 3. Update Unit.currentTenantId and currentLeaseId
   // 4. Calculate prorated first month
   // 5. Create initial Payment record
   // 6. Assign gate code to tenant
   // 7. Send move-in confirmation email + SMS
   // 8. Return full lease + tenant + unit
   ```

---

### Day 3 — Admin APIs + Delinquency

**Goal: All admin operations have working API endpoints.**

1. **`app/api/admin/dashboard/route.ts`** — GET — returns:
   ```typescript
   {
     occupancyRate: number,        // percentage
     totalRevenue: number,         // current month, in cents
     availableUnits: number,
     delinquentCount: number,
     lockedOutCount: number,
     recurringBillingRate: number, // % tenants with autopay
     waitingListCount: number,
     upcomingMoveOuts: number,     // next 30 days
   }
   ```

2. **`app/api/leases/route.ts`** and **`app/api/leases/[id]/route.ts`**
3. **`app/api/leases/[id]/sign/route.ts`** — POST — save signature, generate PDF, update lease
4. **`app/api/tenants/[id]/gate-code/route.ts`** — POST — update gate code, log to AccessLog, send SMS
5. **`app/api/admin/move-out/route.ts`** — POST — end lease, free unit, revoke gate access
6. **`app/api/waiting-list/route.ts`** — GET · POST
7. **`app/api/waiting-list/[id]/route.ts`** — PATCH · DELETE
8. **`jobs/delinquency.ts`** — Full delinquency flow per SHARED_CONTEXT spec
9. **`jobs/autopay.ts`** — Daily charge of all autopay-enabled tenants with upcoming due dates

---

### Day 4 — Cron Jobs + Notifications + PDF + Gate

**Goal: Automation runs reliably. Notifications send. PDFs generate.**

1. **`jobs/reminders.ts`** — Send D-3 payment reminder to all tenants due in 3 days
2. **`jobs/rate-management.ts`** — Rate increase automation per SHARED_CONTEXT spec
   - Must create a pending batch for admin approval before executing
   - Endpoint: `app/api/admin/rate-management/route.ts`
3. **`lib/pdf.ts`** — PDF generation:
   - `generateLease(lease, tenant, unit): Buffer`
   - `generateReceipt(payment, tenant, unit): Buffer`
4. **`app/api/notifications/route.ts`** — POST — manual send from admin
5. **Gate integration:** Build `app/api/gate/route.ts` as a clean interface:
   ```typescript
   // POST — update code in DB, log event, notify tenant
   // When real hardware API is confirmed, only this file changes
   { tenantId: string, newCode: string, reason: 'manual' | 'lockout' | 'restoration' }
   ```
6. Register all cron jobs in `app/api/cron/route.ts` (GET — ping to start jobs on server boot)

---

### Day 5 — Migration + QA + Hardening

**Goal: Real data in. Everything tested. Production ready.**

1. **`scripts/migrate.ts`** — Storable CSV → MongoDB
   - Parse CSV (tenants + units)
   - Create Tenant documents (hash temporary passwords)
   - Create Unit documents
   - Create Lease documents for active tenants
   - Create Stripe Customer for each active tenant
   - Send "welcome to new portal" email with password reset link

2. **API hardening checklist:**
   - [ ] All routes have proper auth checks
   - [ ] All inputs validated with Zod
   - [ ] No raw MongoDB errors leaking to client
   - [ ] Stripe webhook verified before processing
   - [ ] No `console.log` with sensitive data
   - [ ] Rate limiting on auth endpoints (use `lib/rateLimit.ts`)

3. **Coordinate with Dev 2** — walk through every UI flow and confirm API responses match what they expect.

---

## Key Implementation Details

### lib/db.ts — Mongoose singleton
```typescript
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) throw new Error('MONGODB_URI is not defined')

let cached = (global as any).mongoose || { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false })
  }
  cached.conn = await cached.promise
  return cached.conn
}
```

### lib/auth.ts — NextAuth with Credentials
```typescript
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './db'
import Tenant from '@/models/Tenant'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        await connectDB()
        const tenant = await Tenant.findOne({ email: credentials?.email })
        if (!tenant) return null
        const valid = await bcrypt.compare(credentials?.password || '', tenant.password)
        if (!valid) return null
        return {
          id: tenant._id.toString(),
          email: tenant.email,
          name: `${tenant.firstName} ${tenant.lastName}`,
          role: tenant.role,
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    }
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' }
}
```

### middleware.ts — Route Protection
```typescript
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const role = req.nextauth.token?.role

    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  },
  { callbacks: { authorized: ({ token }) => !!token } }
)

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*', '/api/admin/:path*']
}
```

### API Route Pattern — Follow this exactly
```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({ field: z.string() })

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

    await connectDB()

    // ... your logic

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/example]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Communication Protocol with Dev 2

When you finish an API endpoint, post this in your shared channel:

```
✅ ENDPOINT READY: POST /api/payments/intent
Request: { leaseId: string, amount: number, type: 'rent' | 'late_fee', saveCard: boolean }
Response: { success: true, data: { clientSecret: string, paymentIntentId: string } }
Auth: tenant or admin
```

When Dev 2 needs an endpoint you haven't built yet, they post:
```
🔴 BLOCKED: need GET /api/units?status=available
```

Check the channel at least every 2 hours.

---

## Do Not

- Do not build any UI components. That's Dev 2.
- Do not use `any` in TypeScript.
- Do not use `var`. Use `const` and `let`.
- Do not store money as float. Always cents (integer).
- Do not send actual SMS/emails during development — use the `NODE_ENV === 'development'` check to log instead.
- Do not push directly to `main`. Use `dev/backend` branch.
- Do not change `types/index.ts` without telling Dev 2 first.
