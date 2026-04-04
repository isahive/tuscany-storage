# CLAUDE_DEV2.md
# Tuscany Village Self Storage — Dev 2 (Frontend)
# READ SHARED_CONTEXT.md FIRST. THEN READ THIS FILE. THEN START CODING.

---

## Your Role

You are Dev 2. You own the entire frontend of this project:
- Public website (Tailwind CSS only)
- Tenant portal (MUI only)
- Admin panel (MUI only)
- All React components
- MUI theme
- PWA setup

Dev 1 is building the API simultaneously. You will consume their endpoints.
If an endpoint isn't ready yet, build the UI with mock data and swap in the real call when Dev 1 signals it's done.

---

## Styling Rules — Read Carefully

| Area | Framework | Rule |
|---|---|---|
| `app/(public)/` | **Tailwind only** | Zero MUI imports |
| `app/portal/` | **MUI only** | Zero Tailwind classes |
| `app/admin/` | **MUI only** | Zero Tailwind classes |

**Why:** The public site needs to be fast and lightweight. MUI adds ~300KB.
**The split is hard.** If you catch yourself importing from `@mui` in a public page — stop and use Tailwind instead.

---

## MUI Theme — Build This First

**File: `lib/theme.ts`** — This is the single source of truth for all MUI styling.

```typescript
import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary:   { main: '#B8914A', contrastText: '#1C0F06' },
    secondary: { main: '#1C0F06', contrastText: '#FFFFFF' },
    background:{ default: '#FAF7F2', paper: '#FFFFFF' },
    text:      { primary: '#1C0F06', secondary: '#6B7280' },
    error:     { main: '#DC2626' },
    success:   { main: '#16A34A' },
    warning:   { main: '#D97706' },
  },
  typography: {
    fontFamily: '"DM Sans", "Arial", sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #EDE5D8', boxShadow: 'none' }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: { '& .MuiTableCell-head': { backgroundColor: '#1C0F06', color: '#FFFFFF', fontWeight: 600 } }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4 }
      }
    }
  }
})
```

Wrap both portal and admin layouts with this theme in their respective `layout.tsx` files.

---

## Day-by-Day Plan

### Day 1 — Public Website

**Goal: Full public site live with real Tuscany branding.**

Build in this order:

1. **`tailwind.config.ts`** — extend with Tuscany colors:
   ```typescript
   colors: {
     brown:  { DEFAULT: '#1C0F06', light: '#2C1A0E' },
     tan:    { DEFAULT: '#B8914A', light: '#D4A96A' },
     cream:  { DEFAULT: '#FAF7F2' },
     mid:    { DEFAULT: '#EDE5D8' },
     muted:  { DEFAULT: '#8A7B6B' },
     olive:  { DEFAULT: '#4A5E38' },
   }
   ```

2. **`app/layout.tsx`** — root layout with Google Fonts (Playfair Display + DM Sans), viewport meta, PWA meta tags

3. **`components/public/Navbar.tsx`** — sticky, dark background, logo, nav links, phone number, login CTA

4. **`app/(public)/page.tsx`** — Home page with:
   - Hero section (split layout — copy left, quote form right)
   - Trust bar (5 trust signals)
   - Facility photos grid (use Unsplash placeholders until client provides real photos)
   - How it works (4 steps)
   - Why us (features + stats + reviews)
   - CTA banner
   - The quote form calls `GET /api/units?status=available` — mock this until Dev 1 has it ready

5. **`app/(public)/units/page.tsx`** — Units listing:
   - Filter bar (all / climate / drive-up / vehicle / price)
   - Grid of unit cards from `GET /api/units?status=available`
   - Each card has: photo, size, features, price, "Reserve now" button

6. **`app/(public)/units/[slug]/page.tsx`** — Unit detail page

7. **`app/(public)/contact/page.tsx`**

8. **`app/(public)/how-it-works/page.tsx`**

9. **`app/(public)/size-guide/page.tsx`**

10. **`app/(public)/waiting-list/page.tsx`** — Form that calls `POST /api/waiting-list`

11. **`components/public/Footer.tsx`**

**Design reference:** The mockup HTML file we built during planning. Replicate it exactly in Next.js/Tailwind. Same colors, same fonts, same layout.

---

### Day 2 — Tenant Portal

**Goal: Tenants can log in and manage their account.**

**Important:** The portal is MUI. No Tailwind. Use the theme from `lib/theme.ts`.

1. **`app/(auth)/login/page.tsx`** — Clean login form using MUI. Calls NextAuth `signIn('credentials', ...)`.

2. **`app/portal/layout.tsx`** — Portal shell with:
   - MUI `ThemeProvider` wrapping everything
   - Left sidebar with nav links (Dashboard, Payments, Gate Code, Move Out)
   - Top bar with tenant name + logout
   - Responsive drawer on mobile

3. **`app/portal/page.tsx`** — Tenant dashboard:
   - Unit info card (number, size, type)
   - Next payment card (amount + due date + autopay status)
   - Payment progress bar (days until due)
   - Recent gate access log (last 5 entries)
   - Quick action buttons (Pay now, Update gate code, Contact us)
   - Data from: `GET /api/tenants/[id]` + `GET /api/payments?tenantId=&limit=5`

4. **`app/portal/payments/page.tsx`** — Payments page:
   - Current balance card
   - "Pay now" button → opens Stripe payment dialog (use `@stripe/react-stripe-js`)
   - Autopay toggle (calls `PATCH /api/tenants/[id]` with `{ autopayEnabled: true }`)
   - Saved card display
   - Payment history table with receipt download links
   - All from: `GET /api/payments?tenantId=`

5. **`app/portal/gate-code/page.tsx`** — Gate code page:
   - Masked code display with "Reveal" toggle
   - "Request new code" button → confirmation dialog → calls `POST /api/tenants/[id]/gate-code`
   - Recent access log table

6. **`app/portal/move-out/page.tsx`** — Move out notice:
   - Date picker for move-out date
   - Confirmation dialog with billing implications
   - Calls `PATCH /api/leases/[id]` with `{ moveOutDate: ... }`

---

### Day 3 — Admin Panel (Part 1)

**Goal: Operator can see KPIs and manage tenants.**

Admin panel is MUI. Same theme. Different layout.

1. **`app/admin/layout.tsx`** — Admin shell:
   - Wider sidebar with all admin nav items
   - Top bar with "Admin Panel" label + operator name + logout
   - Breadcrumbs

2. **`app/admin/page.tsx`** — KPI Dashboard:
   - 6 metric cards in a grid: Occupancy %, Revenue MTD, Available Units, Delinquent, Locked Out, Waiting List
   - Delinquency breakdown table (tenants past due with days + amount)
   - Upcoming move-outs list
   - Data from `GET /api/admin/dashboard`

3. **`app/admin/tenants/page.tsx`** — Tenant list:
   - MUI DataGrid with columns: Name, Unit, Status chip, Balance, Next payment, Actions
   - Search + filter by status (active / delinquent / locked_out)
   - "New tenant" button → opens move-in dialog
   - Data from `GET /api/tenants`

4. **`app/admin/tenants/[id]/page.tsx`** — Tenant detail:
   - Personal info card with edit button
   - Lease info card
   - Payment history table
   - Gate access log
   - Action buttons: Lock out / Restore access / Send notification / Move out
   - Data from `GET /api/tenants/[id]`

5. **`app/admin/units/page.tsx`** — Unit grid:
   - Visual grid showing all units with color-coded status
   - Filter by status / type / size
   - Click unit → opens detail drawer

---

### Day 4 — Admin Panel (Part 2) + PWA

**Goal: Full admin functionality. App installable on mobile.**

1. **`app/admin/payments/page.tsx`** — Payments overview:
   - Revenue chart (MUI X Charts or Recharts)
   - Payments table with filters
   - Failed payments section with retry buttons

2. **`app/admin/delinquency/page.tsx`** — Delinquency management:
   - Table of all delinquent tenants sorted by days past due
   - Stage indicator (Late / Locked Out / Pre-Lien / Lien)
   - Bulk actions: send reminder, lock out, mark for auction

3. **`app/admin/rate-management/page.tsx`** — Rate management:
   - Pending rate increase batches awaiting approval
   - Each batch shows: units affected, current rate, proposed rate, effective date
   - Approve / Reject buttons per batch
   - Data from `GET /api/admin/rate-management`

4. **`app/admin/waiting-list/page.tsx`** — Waiting list:
   - Table of all waiting list entries
   - "Notify" button — marks as notified, sends SMS/email to person
   - "Convert to tenant" button → pre-fills move-in form

5. **`app/admin/settings/page.tsx`** — Settings:
   - Facility info (name, address, phone)
   - Notification templates (editable text for each email/SMS type)
   - Delinquency settings (grace period days, late fee amount)
   - Gate access settings

6. **PWA Setup:**
   - `public/manifest.json` — see SHARED_CONTEXT for required fields
   - Add push notification support for payment reminders
   - Test "Add to Home Screen" on iOS and Android
   - Service worker handles offline fallback page

---

### Day 5 — QA + Polish + Handoff

**Goal: Everything looks great, works on mobile, and client can use it.**

1. **Responsive audit** — test every page on:
   - iPhone 14 (390px)
   - iPad (768px)
   - Desktop (1280px)

2. **Public site SEO audit:**
   - Every page has `<title>` and `<meta name="description">`
   - Root layout has LocalBusiness JSON-LD schema
   - `app/sitemap.ts` generates dynamic sitemap
   - `app/robots.ts` allows indexing

3. **Loading states** — every data-fetching page needs:
   - MUI `Skeleton` components while loading (portal + admin)
   - Tailwind placeholder shimmer (public site)

4. **Error states** — every page needs:
   - Empty state illustration when no data
   - Error boundary with "something went wrong" message

5. **E-sign lease flow:**
   - Canvas signature component in the reservation flow
   - Captures signature as base64
   - Sends to `POST /api/leases/[id]/sign`
   - Shows confirmation with PDF download link

6. **Coordinate with Dev 1** for final integration test:
   - Complete move-in flow (admin)
   - Complete payment flow (portal)
   - Gate code update
   - Delinquency escalation visual

---

## API Consumption Pattern

When calling Dev 1's endpoints, always use this pattern:

```typescript
// lib/api.ts — shared fetch wrapper
export async function apiCall<T>(
  path: string,
  options?: RequestInit
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  return res.json()
}

// Usage in a component
const result = await apiCall<Unit[]>('/units?status=available')
if (!result.success) {
  // handle error
  return
}
const units = result.data
```

---

## Mock Data Pattern

While waiting for Dev 1's endpoints, use this pattern:

```typescript
// lib/mocks.ts
export const MOCK_UNITS: Unit[] = [
  { _id: '1', unitNumber: '14B', size: '10x10', price: 10000, status: 'available', ... },
  { _id: '2', unitNumber: '22A', size: '10x20', price: 16500, status: 'available', ... },
]

// In your component
const isDev = process.env.NODE_ENV === 'development'
const units = isDev && !apiReady ? MOCK_UNITS : await apiCall('/units')
```

When Dev 1 signals an endpoint is ready, remove the mock and use the real call.

---

## Stripe Frontend Setup

For the payment form in the tenant portal:

```typescript
// Install: npm install @stripe/stripe-js @stripe/react-stripe-js

// app/portal/payments/page.tsx
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Flow:
// 1. Call POST /api/payments/intent to get clientSecret
// 2. Pass clientSecret to <Elements stripe={stripePromise} options={{ clientSecret }}>
// 3. Render <PaymentElement /> inside
// 4. On submit, call stripe.confirmPayment()
```

---

## Component Conventions

### MUI Components (portal + admin)
```typescript
// Always use MUI's sx prop for one-off styles — no inline style objects
// Good
<Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>

// Never import from @mui in public components
// Never use className with Tailwind in MUI components
```

### Public Site Components
```typescript
// Always use Tailwind classes
// Good
<div className="bg-brown text-white px-4 py-2 rounded">

// Never import from @mui in public components
```

### Formatting money (always)
```typescript
// lib/utils.ts
export const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

// Usage: formatMoney(10000) → "$100.00"
```

### Formatting dates (always)
```typescript
export const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
```

---

## Status Chip Colors (MUI — use consistently)

```typescript
const STATUS_COLORS = {
  active:      { bg: '#D1FAE5', color: '#065F46' },
  delinquent:  { bg: '#FEF3C7', color: '#92400E' },
  locked_out:  { bg: '#FEE2E2', color: '#991B1B' },
  moved_out:   { bg: '#F3F4F6', color: '#374151' },
  available:   { bg: '#D1FAE5', color: '#065F46' },
  occupied:    { bg: '#DBEAFE', color: '#1E3A5F' },
  maintenance: { bg: '#FEF3C7', color: '#92400E' },
  reserved:    { bg: '#EDE9FE', color: '#3B0764' },
  succeeded:   { bg: '#D1FAE5', color: '#065F46' },
  failed:      { bg: '#FEE2E2', color: '#991B1B' },
  pending:     { bg: '#FEF3C7', color: '#92400E' },
}
```

---

## Communication Protocol with Dev 1

When you need an endpoint that isn't ready:
```
🔴 BLOCKED: need GET /api/units?status=available&type=climate_controlled
Need response shape: Unit[] with fields: _id, unitNumber, size, type, price, status, features
```

When you confirm an endpoint works with your UI:
```
✅ CONFIRMED: POST /api/payments/intent works with portal payment form
```

Check the channel at least every 2 hours.

---

## Do Not

- Do not build any API routes. That's Dev 1.
- Do not import MUI in any file under `app/(public)/`.
- Do not import Tailwind classes in any MUI component.
- Do not hardcode money as floats. Use the `formatMoney` util.
- Do not make up API response shapes. Use what's in `types/index.ts` or ask Dev 1.
- Do not push directly to `main`. Use `dev/frontend` branch.
- Do not change `types/index.ts` without telling Dev 1 first.
- Do not install packages without checking `package.json` first — Dev 1 may have already installed it.
