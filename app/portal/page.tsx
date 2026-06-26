'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MoveInCompleteDialog from '@/components/portal/MoveInCompleteDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contact {
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  address: string
  addressLine2: string
  city: string
  state: string
  zip: string
}

interface Balance {
  outstanding: number
  credit: number
  balance: number
}

interface Rental {
  leaseId: string
  unitId: string | null
  unitNumber: string
  size: string
  monthlyRate: number
  status: string
  movedInAt: string
  moveOutDate: string | null
  nextBillAt: string
  deposit: number
  protectionPlanId: string | null
  agreementSigned: boolean
  signedAt: string | null
}

interface BillingRow {
  _id: string
  createdAt: string
  type: string
  direction: 'charge' | 'payment'
  status: string
  amount: number
  description: string
  balanceAfter: number
  periodStart: string | null
  periodEnd: string | null
  dueDate: string | null
}

interface DashboardData {
  contact: Contact
  status: string
  lockedOut: boolean
  gateCode: string
  balance: Balance
  rentals: Rental[]
  billingHistory: BillingRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  pending_moveout: 'Moving out',
}

function billingItemLabel(row: BillingRow): string {
  if (row.direction === 'payment') {
    if (row.status === 'refunded') return 'Refund'
    if (row.status === 'voided') return 'Void'
    return 'Payment'
  }
  const map: Record<string, string> = {
    rent: 'Monthly Rent invoiced.',
    late_fee: 'Past Due Fee invoiced.',
    deposit: 'Security Deposit invoiced.',
    prorated: 'Prorated invoiced.',
    other: 'Fee invoiced.',
    credit: 'Credit',
  }
  return map[row.type] ?? row.type
}

function billingDescription(row: BillingRow): string {
  if (row.description) return row.description
  // Rent is a monthly prepayment due on the 1st — show the due date, not the
  // period range, whose end (last day of the month) reads like a due date.
  const rentDue = row.dueDate ?? row.periodStart
  if (row.type === 'rent' && rentDue) {
    return `Due date: ${fmtDate(rentDue)}`
  }
  if (row.periodStart && row.periodEnd) {
    return `Period: ${fmtDate(row.periodStart)} – ${fmtDate(row.periodEnd)}`
  }
  if (row.dueDate) return `Due date: ${fmtDate(row.dueDate)}`
  return ''
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PortalDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    }>
      <PortalDashboard />
    </Suspense>
  )
}

function PortalDashboard() {
  const search = useSearchParams()
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissedAgreement, setDismissedAgreement] = useState(false)
  const [showMoveOutSuccess, setShowMoveOutSuccess] = useState(false)

  useEffect(() => {
    if (search.get('moveout') === 'success') setShowMoveOutSuccess(true)
  }, [search])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/portal/dashboard')
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-700">Unable to load your dashboard. Please refresh or contact support.</p>
      </div>
    )
  }

  const { contact, lockedOut, balance, rentals, billingHistory, gateCode } = data
  const unsignedRentals = rentals.filter((r) => !r.agreementSigned)

  return (
    <div className="space-y-4">
      {/* Storable parity — post-move-in welcome pop-up driven by ?welcome=1
          on the redirect from the reserve flow. Wrapped in Suspense because
          useSearchParams suspends during the initial client render. */}
      <Suspense fallback={null}>
        <MoveInCompleteDialog />
      </Suspense>

      {/* ── Banners ── */}
      {showMoveOutSuccess && (
        <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-gray-800">Successfully requested move out.</p>
          <button
            type="button"
            onClick={() => setShowMoveOutSuccess(false)}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {unsignedRentals.length > 0 && !dismissedAgreement && (
        <div className="flex items-center justify-between rounded border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-gray-800">
            Your Storage Agreement has not been signed: Please{' '}
            <Link
              href={`/portal/lease/sign?leaseId=${unsignedRentals[0].leaseId}`}
              className="ml-2 inline-block rounded bg-olive px-4 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark"
            >
              Sign Unit {unsignedRentals[0].unitNumber} Agreement
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setDismissedAgreement(true)}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {lockedOut && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-gray-800">
          <strong>This account has been locked out.</strong> Please{' '}
          <Link href="/portal/payments" className="font-semibold underline">
            make a payment
          </Link>{' '}
          to remove the lock out.
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">

        {/* Left column — Contact Info + Balance */}
        <div className="space-y-4">
          {/* Contact Info card */}
          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-3 text-center">
              <h2 className="font-display text-lg font-semibold text-olive-darker">Contact Info</h2>
            </header>
            <div className="space-y-3 px-4 py-4 text-sm">
              <ContactRow icon="user" label="Name" value={contact.fullName} />
              <ContactRow icon="mail" label="Email" value={contact.email} />
              <ContactRow icon="phone" label="Cell Phone" value={contact.phone} />
              <ContactRow
                icon="map"
                label="Address"
                value={
                  contact.address
                    ? `${contact.address}\n${contact.addressLine2 ? contact.addressLine2 + '\n' : ''}${contact.city}, ${contact.state} ${contact.zip}`
                    : ''
                }
              />
            </div>
          </section>

          {/* Balance card */}
          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-3 text-center">
              <h2 className="font-display text-lg font-semibold text-olive-darker">Balance</h2>
            </header>
            <div className="px-4 py-4 text-sm">
              <BalanceRow label="Outstanding" value={fmtMoney(balance.outstanding)} highlight={balance.outstanding > 0} />
              <BalanceRow label="Credit" value={fmtMoney(balance.credit)} />
              <BalanceRow label="Balance" value={fmtMoney(balance.balance)} bold />
            </div>
            <div className="border-t border-gray-200 px-4 py-3">
              <Link
                href="/portal/payments"
                className="block rounded bg-olive px-4 py-2 text-center text-sm font-semibold text-white hover:bg-olive-dark"
              >
                Make a Payment
              </Link>
            </div>
          </section>
        </div>

        {/* Right column — Current Rentals + Billing History */}
        <div className="space-y-4">
          {/* Current Rentals card */}
          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-3 text-center">
              <h2 className="font-display text-lg font-semibold text-olive-darker">Current Rentals</h2>
            </header>

            <div className="px-6 py-5">
              <p className="mb-3 text-center text-base font-semibold text-olive-darker">
                Access Code: {gateCode || '—'}
              </p>

              {rentals.length === 0 ? (
                <p className="text-center text-sm text-gray-600">You don&apos;t have any active rentals.</p>
              ) : (
                rentals.map((rental, idx) => (
                  <div key={rental.leaseId} className={idx > 0 ? 'mt-6 border-t border-gray-200 pt-6' : ''}>
                    <h3 className="mb-3 text-center font-display text-lg font-semibold text-olive-darker">
                      Unit {rental.unitNumber}
                    </h3>

                    <dl className="mx-auto max-w-md space-y-1.5 text-sm">
                      <RentalRow label="Size" value={rental.size || '—'} />
                      <RentalRow label="Price" value={`${fmtMoney(rental.monthlyRate)} each month`} />
                      <RentalRow label="Status" value={STATUS_LABEL[rental.status] ?? rental.status} />
                      <RentalRow
                        label="Documents"
                        value={
                          rental.agreementSigned ? (
                            <span className="text-gray-700">Signed {rental.signedAt ? fmtDate(rental.signedAt) : ''}</span>
                          ) : (
                            <Link
                              href={`/portal/lease/sign?leaseId=${rental.leaseId}`}
                              className="text-[#3E5DAA] underline hover:no-underline"
                            >
                              Sign Agreement
                            </Link>
                          )
                        }
                      />
                      <RentalRow label="Moved-in" value={fmtDate(rental.movedInAt)} />
                      <RentalRow
                        label="Moved-out"
                        value={
                          rental.status === 'pending_moveout' && rental.moveOutDate ? (
                            <span className="text-gray-700">{fmtDate(rental.moveOutDate)}</span>
                          ) : (
                            <Link
                              href={`/portal/move-out?leaseId=${rental.leaseId}`}
                              className="text-[#3E5DAA] underline hover:no-underline"
                            >
                              Request Move Out
                            </Link>
                          )
                        }
                      />
                      <RentalRow label="Next Bill" value={fmtDate(rental.nextBillAt)} />
                      <RentalRow label="Deposit Paid" value={fmtMoney(rental.deposit)} />
                      <RentalRow
                        label="Tenant Protection"
                        value={
                          rental.protectionPlanId ? (
                            <span className="text-gray-700">On file</span>
                          ) : (
                            <Link href="/portal/protection" className="text-[#3E5DAA] underline hover:no-underline">
                              Add Protection
                            </Link>
                          )
                        }
                      />
                      <RentalRow
                        label="Proof of Coverage"
                        value={
                          <Link href="/portal/protection" className="text-[#3E5DAA] underline hover:no-underline">
                            Provide Info
                          </Link>
                        }
                      />
                    </dl>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 px-4 py-3">
              <Link
                href="/units"
                className="inline-block rounded bg-olive px-4 py-2 text-sm font-semibold text-white hover:bg-olive-dark"
              >
                Rent New Unit
              </Link>
            </div>
          </section>

          {/* Billing History card */}
          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-3 text-center">
              <h2 className="font-display text-lg font-semibold text-olive-darker">Billing History</h2>
            </header>

            <div className="overflow-x-auto">
              {billingHistory.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-600">No billing history yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-700">
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                      <th className="px-4 py-2 text-right font-semibold">Charges</th>
                      <th className="px-4 py-2 text-right font-semibold">Payments/Voids</th>
                      <th className="px-4 py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((row) => {
                      const isPayment = row.direction === 'payment'
                      return (
                        <tr key={row._id} className="border-t border-gray-100 align-top">
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <Link
                              href={`/portal/transaction/${row._id}`}
                              className="text-[#3E5DAA] underline hover:no-underline"
                            >
                              {fmtDate(row.createdAt)}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <div>{billingItemLabel(row)}</div>
                            {billingDescription(row) && (
                              <div className="text-xs text-gray-600">{billingDescription(row)}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isPayment ? '' : fmtMoney(row.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isPayment ? fmtMoney(row.amount) : ''}
                          </td>
                          <td className="px-4 py-2.5 text-right">{fmtMoney(row.balanceAfter)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-gray-200 px-4 py-3">
              <Link
                href="/portal/billing-history"
                className="inline-block rounded bg-olive px-4 py-2 text-sm font-semibold text-white hover:bg-olive-dark"
              >
                Full History
              </Link>
            </div>
          </section>
        </div>
      </div>

    </div>
  )
}

// ─── Small components ────────────────────────────────────────────────────────

function ContactRow({ icon, label, value }: { icon: 'user' | 'mail' | 'phone' | 'map'; label: string; value: string }) {
  const icons: Record<typeof icon, React.ReactElement> = {
    user: (
      <svg className="h-4 w-4 text-olive-darker" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0v.75H4.5v-.75z" />
      </svg>
    ),
    mail: (
      <svg className="h-4 w-4 text-olive-darker" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75M22.5 6.75L12 13.5 1.5 6.75" />
      </svg>
    ),
    phone: (
      <svg className="h-4 w-4 text-olive-darker" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
    map: (
      <svg className="h-4 w-4 text-olive-darker" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  }
  return (
    <div>
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        {icons[icon]}
        {label}
      </div>
      <div className="ml-6 whitespace-pre-line text-gray-700">{value || '—'}</div>
    </div>
  )
}

function BalanceRow({ label, value, highlight, bold }: { label: string; value: string; highlight?: boolean; bold?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 py-1">
      <div className={`text-right ${bold ? 'font-semibold' : 'text-gray-700'}`}>{label}</div>
      <div className={`${highlight ? 'text-red-700 font-semibold' : bold ? 'font-semibold' : 'text-gray-700'}`}>
        {value}
      </div>
    </div>
  )
}

function RentalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-baseline gap-3">
      <dt className="text-right font-semibold text-gray-900">{label}</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  )
}

