# Billing-history feed (storEDGE → Atlas)

How to migrate a customer's full billing history from Storable Easy (storEDGE)
into this app. Written so any developer or AI agent can run the flow without
prior context.

## Why this exists

The May 2026 customer import created tenants/units/leases but the payment
history was incomplete and the rows lacked `periodStart`. The delinquency cron
decides "did they pay the current period?" from `Payment.periodStart`, so
imported customers were spuriously marked late → locked out → auction
scheduled, and their `tenant.balance` drifted into garbage (e.g. a paid-up
customer showing $6,459 owed). The fix is to re-feed each customer's history
from storEDGE, which is the authoritative source.

## The flow (per customer)

1. In storEDGE, open the customer's billing history and copy the entire
   ledger text (newest first, exactly as displayed).
2. Save it to `data/billing-history/raw/<name>.txt` with **the customer's
   email alone on line 1**, paste below it. Don't reformat anything.
3. Dry run — parses, validates, writes the audit JSON, touches nothing:

   ```
   npm run feed:billing -- data/billing-history/raw/<name>.txt
   ```

4. Check the output:
   - `Final balance` must match what storEDGE shows for the customer.
   - `Balance check … ✔` means every row's computed running balance equals
     the balance storEDGE displayed next to it.
   - `UNPARSED BLOCKS` means the paste has a block shape the parser doesn't
     know yet. **Extend the parser** (`scripts/feed-billing.ts`) for that
     shape — never hand-edit the data to make it fit. The script refuses to
     `--apply` while unparsed blocks exist.
5. Apply:

   ```
   npm run feed:billing -- data/billing-history/raw/<name>.txt --apply
   ```

6. Read the verification line at the end: `Delinquency check … covered ✔`
   confirms the nightly cron will leave the tenant alone.

The dry run + apply each take ~5 seconds regardless of history size (one
`deleteMany` + one `insertMany`).

## What `--apply` does

- **Wipes all existing `payments` rows for the tenant** and inserts the
  parsed history. The storEDGE paste is authoritative; stale rows from
  earlier imports double-count. (This is why you feed the *whole* ledger,
  not a date range.)
- Staggers `createdAt` by one minute per row within each day so the portal's
  newest-first list shows the same order storEDGE does.
- Fixes each active lease from the history itself:
  - `monthlyRate` = latest full rent charge + promotional savings (unit
    prices in the `units` collection are often stale — the history wins),
  - `billingDay` = day-of-month of that charge's period start,
  - `startDate` = first transaction mentioning that unit,
  - `deposit` = the "Unit X Deposit" charge.
- Sets `tenant.balance` to the computed final balance. When it's ≤ 0 it also
  restores `status: 'active'`, clears `lockedOutAt` and the lease's
  `auctionDate`/`auctionScheduledAt` (undoing spurious delinquency).
- Multi-unit tenants: charge rows attach to their own unit's lease; payment
  rows that cover several units attach to the lease the delinquency cron
  evaluates (`Lease.findOne({tenantId, status:'active'})` — first in natural
  order), so the cron sees the period as paid.

## Parser reference

Input blocks are separated by `Transactions` / `Line items` / `Refunds`
header lines (skipped). Block shapes understood:

| Shape | Example title | Becomes |
|---|---|---|
| Invoice | `6/5/2026  134207294  Rent invoiced.` (title on the date line) | `direction: charge`, type from title (`rent`, `deposit`, `prorated`, `late_fee`, protection → `other`) |
| Payment | `$250.00 payment by Visa ending in 7694:` | `direction: payment, type: rent`, succeeded |
| Failed payment | `Message: Transaction declined…` or a `FAILED` line | same but `status: failed` |
| Credit grant | `$260.00 credit without payment:` | `type: credit`, succeeded |
| Credit application | `$45.00 credit:` + `Paid …` lines | parsed + validated but **NOT imported** (see below) |
| Void | `Void:` + `Canceled $X of …` | `direction: payment, status: voided` — offsets the kept charge row |
| Refund | `3/31/2026  414336  $20.00 refund of Ach payment` | `direction: payment, status: refunded` |

Per-row details extracted: `Due date:` → `dueDate`; `…period starting
M/D/YYYY` → `periodStart` (+1 month → `periodEnd`); `…for M/D/YYYY to
M/D/YYYY` (prorated) → both; `Unit X` mentions → lease assignment.

### Balance semantics (storEDGE-exact)

```
charge                  → balance += amount
payment (succeeded)     → balance -= amount
payment failed/refunded → no change
void                    → balance -= amount   (offsets the canceled charge)
credit grant            → balance -= amount   (creates the credit)
credit application      → no change           (allocates existing credit to invoices)
```

**Credit applications are validated but NOT inserted.** The app's source of
truth is `GET /api/tenants/[id]/balance`, which recomputes the balance from
every row via `lib/paymentBalance.balanceDelta` — where ANY succeeded credit
row subtracts — and persists the result the moment someone opens the
customer's page. A storEDGE application is allocation-only (the payment that
added the credit already subtracted; the prepaid invoice charge already
adds), so inserting it double-counts the credit. This surfaced as Bob Neland
showing a phantom $290 credit. The feeder asserts before applying that its
rows reproduce the storEDGE final balance under `balanceDelta` and refuses to
write otherwise; `scripts/verify-ledger.ts` re-checks fed customers.

`periodStart` **must** be present on rent payment rows — it's what the
delinquency cron reads. The parser sets it automatically.

### Known storEDGE display quirk

When a payment is later partially refunded, storEDGE shows the payment net of
the refund but renders the *invoice rows in between* with the pre-refund
balance, so a handful of rows can mismatch by exactly the refunded amount and
re-sync at the next payment. If the mismatch block is bounded like that and
the final balance matches, it's safe to apply (seen on Ashley Lawson,
3/25/2026, $20).

## Interaction with the crons

- `jobs/delinquency.ts` (fixed 2026-06-12): only counts `direction:
  'payment'` rows, treats `tenant.balance <= 0` as current (restores +
  clears auction), and skips leases that started after the current billing
  date. Customers whose history hasn't been re-fed yet may still carry
  garbage positive balances and stay escalated until fed.
- `jobs/invoices.ts` bills `lease.monthlyRate` on `billingDay` (7-day lead),
  deduped by `periodStart` — another reason the imported rows must carry it.
- Recurring **tenant protection fees are not billed by any cron yet** and
  `protectionplans` is empty; history rows for them import as `type: 'other'`
  but nothing recharges monthly. Pending product decision.

## Things NOT to do

- Don't run `npm run seed:customers` against a new CSV — it upserts by email
  and **overwrites every existing tenant's balance/status** with the CSV
  snapshot values.
- Don't apply a feed whose final balance disagrees with storEDGE.
- For a customer who genuinely owes money (final balance > 0): the feeder
  leaves their status alone, but review their unpaid recent charges before
  trusting cron escalation timing.

## File map

- `scripts/feed-billing.ts` — the feeder (parser + validator + applier).
- `data/billing-history/raw/<name>.txt` — raw pastes (input, kept for audit).
- `data/billing-history/<name>.json` — normalized rows + computed vs.
  displayed balance per row (written by every run, the audit artifact).
- `scripts/import-billing-history.ts` — older hand-built-JSON importer, still
  works (`npm run import:billing -- <slug>`); the feeder supersedes it.
- `scripts/crossmatch-customers.ts <csv>` — audits every CSV customer against
  DB tenants/units. `scripts/verify-duplicates.ts` — prints what the
  /admin/tenants/duplicates panel will show.

## State (June 2026)

Fed so far: April Marlow (`april-marlow`), Ashley Lawson (`ashley-lawson`),
Ben Poeppelman (`ben-poeppelman`). Everyone else still has May-import rows
without `periodStart` and possibly wrong balances/lease rates — feed them as
Jessica provides the pastes. Open item: April Marlow's email is a typo in
storEDGE itself (`marlowapril09@hmail.com`) while her real gmail sits on
Michael j higginbotham's record — flagged in the duplicates panel, pending
Jessica.
