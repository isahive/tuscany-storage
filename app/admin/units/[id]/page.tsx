'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatMoney, formatDate } from '@/lib/utils'
import {
  DISPLAY_STATUS_COLORS,
  DISPLAY_STATUS_LABELS,
  type UnitDisplayStatus,
} from '@/lib/unitStatus'
import type { UnitStatus, UnitType, TenantStatus } from '@/types'

interface PopulatedTenant {
  _id: string
  firstName: string
  lastName: string
  status: TenantStatus
  lockedOutAt?: string | null
}

interface PopulatedLease {
  _id: string
  startDate: string
  monthlyRate: number
  billingDay: number
  status: 'active' | 'ended' | 'pending_moveout'
  auctionDate?: string | null
}

interface PopulatedUnit {
  _id: string
  unitNumber: string
  size: string
  type: UnitType
  price: number
  status: UnitStatus
  displayStatus: UnitDisplayStatus
  features: string[]
  pricingOptions?: Array<{ amount: number; intervalMonths: number }>
  defaultDeposit?: number
  defaultSetupFee?: number
  reservationPrice?: number
  notes?: string
  currentTenantId?: PopulatedTenant | string | null
  currentLeaseId?: PopulatedLease | string | null
  createdAt: string
  updatedAt: string
  createdByName?: string
  updatedByName?: string
  nextBillDate?: string | null
}

const TYPE_LABEL: Record<UnitType, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle / Outdoor',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const meridian = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${date} ${String(h).padStart(2, '0')}:${m}${meridian}`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UnitDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const unitId = params.id

  const [unit, setUnit] = useState<PopulatedUnit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/units/${unitId}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? `Failed to load unit (${res.status})`)
      setUnit(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load unit')
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/admin/units" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:underline">
          ← Back to Units
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? 'Unit not found'}
          <button onClick={fetchData} className="ml-3 underline">Retry</button>
        </div>
      </div>
    )
  }

  const tenant = unit.currentTenantId && typeof unit.currentTenantId === 'object'
    ? (unit.currentTenantId as PopulatedTenant)
    : null
  const lease = unit.currentLeaseId && typeof unit.currentLeaseId === 'object'
    ? (unit.currentLeaseId as PopulatedLease)
    : null

  const statusC = DISPLAY_STATUS_COLORS[unit.displayStatus]

  const pricingOptions: Array<{ amount: number; intervalMonths: number }> =
    unit.pricingOptions && unit.pricingOptions.length > 0
      ? unit.pricingOptions
      : [{ amount: unit.price, intervalMonths: 1 }]

  const reservationPrice = unit.reservationPrice ?? unit.price * 2
  const defaultDeposit = unit.defaultDeposit ?? unit.price
  const defaultSetupFee = unit.defaultSetupFee ?? 0
  const isLocked = tenant?.status === 'locked_out'

  return (
    <div className="mx-auto max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className="mb-4 flex items-center justify-between rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-green-700 hover:text-green-900">✕</button>
        </div>
      )}

      {/* Header card */}
      <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-olive" />
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/units" className="text-sm text-gray-500 hover:text-olive-darker hover:underline">
              ← Back
            </Link>
            <div className="h-6 border-l border-gray-300" />
            <div>
              <h1 className="font-display text-2xl font-semibold text-olive-darker">Unit {unit.unitNumber}</h1>
              <p className="text-xs text-gray-500">{TYPE_LABEL[unit.type]} · {unit.size}</p>
            </div>
            <span
              className="ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: statusC.bg, color: statusC.text }}
            >
              {DISPLAY_STATUS_LABELS[unit.displayStatus]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push(`/admin/units/${unit._id}/history`)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Unit History
            </button>
            {tenant && lease && (
              <button
                onClick={() => router.push(`/admin/tenants/${tenant._id}/schedule-move-out?leaseId=${lease._id}`)}
                className="rounded border border-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
              >
                Move Out
              </button>
            )}
            <button
              onClick={() => setStatusOpen(true)}
              className="rounded border border-olive px-3 py-1.5 text-sm font-semibold text-olive-darker hover:bg-olive/5"
            >
              Change Status
            </button>
            <button
              onClick={() => router.push(`/admin/units/${unit._id}/edit`)}
              className="rounded bg-olive px-3 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: specs + pricing */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-2.5">
              <h2 className="font-display text-base font-semibold text-olive-darker">Unit specs</h2>
            </header>
            <dl className="divide-y divide-gray-100 px-4 py-2 text-sm">
              <DetailRow label="Unit number" value={unit.unitNumber} />
              <DetailRow label="Size" value={unit.size} />
              <DetailRow label="Type" value={TYPE_LABEL[unit.type]} />
              <DetailRow
                label="Features"
                value={
                  unit.features.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {unit.features.map((f) => (
                        <span key={f} className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-gray-500">None</span>
                }
              />
              {unit.notes && <DetailRow label="Notes" value={unit.notes} />}
            </dl>
          </section>

          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-2.5">
              <h2 className="font-display text-base font-semibold text-olive-darker">Pricing</h2>
            </header>
            <dl className="divide-y divide-gray-100 px-4 py-2 text-sm">
              <DetailRow
                label="Pricing options"
                value={
                  <div>
                    {pricingOptions.map((p, i) => (
                      <div key={i}>{formatMoney(p.amount)} / {p.intervalMonths} {p.intervalMonths === 1 ? 'month' : 'months'}</div>
                    ))}
                  </div>
                }
              />
              <DetailRow label="Deposit" value={formatMoney(defaultDeposit)} />
              <DetailRow label="Setup fee" value={formatMoney(defaultSetupFee)} />
              <DetailRow label="Reservation price" value={formatMoney(reservationPrice)} />
            </dl>
          </section>
        </div>

        {/* Right: customer + audit */}
        <div className="space-y-4">
          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-2.5">
              <h2 className="font-display text-base font-semibold text-olive-darker">Customer</h2>
            </header>
            {tenant ? (
              <div className="space-y-3 px-4 py-3 text-sm">
                <div>
                  <Link href={`/admin/tenants/${tenant._id}`} className="font-semibold text-[#3E5DAA] hover:underline">
                    {tenant.firstName} {tenant.lastName}
                  </Link>
                  {isLocked && (
                    <span className="ml-2 inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      Locked Out
                    </span>
                  )}
                </div>
                {isLocked && tenant.lockedOutAt && (
                  <p className="text-xs text-red-700">Locked on {formatDateTime(tenant.lockedOutAt)}</p>
                )}
                {lease && (
                  <>
                    <DetailRow label="Rented since" value={formatDateTime(lease.startDate)} compact />
                    <DetailRow label="Billing cycle" value={`${formatMoney(lease.monthlyRate)} / month`} compact />
                    {unit.nextBillDate && <DetailRow label="Next bill" value={formatDate(unit.nextBillDate)} compact />}
                    {lease.auctionDate && (
                      <DetailRow
                        label="Auction date"
                        value={<span className="font-semibold text-red-700">{formatDate(lease.auctionDate)}</span>}
                        compact
                      />
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-gray-500">
                {unit.status === 'available' ? 'Available — no customer.' : 'No customer on file.'}
              </div>
            )}
          </section>

          <section className="rounded border border-gray-200 bg-white">
            <header className="border-b border-gray-200 px-4 py-2.5">
              <h2 className="font-display text-base font-semibold text-olive-darker">Audit</h2>
            </header>
            <dl className="divide-y divide-gray-100 px-4 py-2 text-sm">
              <DetailRow label="Created" value={`${formatDateTime(unit.createdAt)}${unit.createdByName ? ` · ${unit.createdByName}` : ''}`} compact />
              <DetailRow label="Updated" value={`${formatDateTime(unit.updatedAt)}${unit.updatedByName ? ` · ${unit.updatedByName}` : ''}`} compact />
            </dl>
          </section>
        </div>
      </div>

      {/* Change Status modal */}
      {statusOpen && (
        <ChangeStatusModal
          unit={unit}
          hasActiveTenant={!!tenant}
          onClose={() => setStatusOpen(false)}
          onSuccess={(msg) => {
            setStatusOpen(false)
            setToast(msg)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value, compact }: { label: string; value: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-[140px_1fr] items-baseline gap-3 ${compact ? 'py-1.5' : 'py-2'}`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value || '—'}</dd>
    </div>
  )
}

// ─── Smart Change Status modal ────────────────────────────────────────────────

type Action =
  | 'available'
  | 'reserved'
  | 'rented'
  | 'maintenance'
  | 'mark_late'
  | 'mark_pre_lien'
  | 'mark_lien'
  | 'lock_out'
  | 'auction'

function ChangeStatusModal({
  unit, hasActiveTenant, onClose, onSuccess,
}: {
  unit: PopulatedUnit
  hasActiveTenant: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<Action | null>(null)
  const [auctionDate, setAuctionDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patchStatus(status: UnitStatus) {
    const res = await fetch(`/api/units/${unit._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update')
  }

  async function handleSubmit() {
    if (!picked) return
    setError(null)
    setSubmitting(true)
    try {
      switch (picked) {
        case 'available': {
          const res = await fetch(`/api/admin/units/${unit._id}/release`, { method: 'POST' })
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json.error ?? 'Release failed')
          onSuccess('Unit released and marked available.')
          return
        }
        case 'reserved': {
          await patchStatus('reserved')
          onSuccess('Unit marked reserved.')
          return
        }
        case 'maintenance': {
          await patchStatus('maintenance')
          onSuccess('Unit marked unavailable for maintenance.')
          return
        }
        case 'rented': {
          // Redirect to the tenant picker — admin selects who to rent it to.
          router.push(`/admin/tenants?rentUnitId=${unit._id}`)
          return
        }
        case 'mark_late':
        case 'mark_pre_lien':
        case 'mark_lien': {
          const daysUnpaid = picked === 'mark_late' ? 5 : picked === 'mark_pre_lien' ? 32 : 62
          const res = await fetch(`/api/admin/units/${unit._id}/mark-delinquent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daysUnpaid }),
          })
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to mark delinquent')
          onSuccess(`Tenant marked ${daysUnpaid} days past due.`)
          return
        }
        case 'lock_out': {
          const res = await fetch(`/api/admin/units/${unit._id}/mark-delinquent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daysUnpaid: 32, lockOutTenant: true }),
          })
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to lock out tenant')
          onSuccess('Tenant locked out.')
          return
        }
        case 'auction': {
          const res = await fetch(`/api/admin/units/${unit._id}/schedule-auction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auctionDate: new Date(auctionDate).toISOString() }),
          })
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to schedule auction')
          onSuccess(`Auction scheduled for ${formatDate(auctionDate)}.`)
          return
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="font-display text-lg font-semibold text-olive-darker">Change unit status</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close">✕</button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <p className="text-xs text-gray-600">
            Pick what should happen to <strong>Unit {unit.unitNumber}</strong>. Status changes that require a customer
            (Rented, Lien, Auction…) will walk you through the right flow.
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Unit state</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <StatusOption picked={picked === 'available'} onClick={() => setPicked('available')} label="Available" sub="Release the unit so it's bookable again." dotColor={DISPLAY_STATUS_COLORS.available.bg} />
              <StatusOption picked={picked === 'reserved'} onClick={() => setPicked('reserved')} label="Reserved" sub="Hold the unit without a customer." dotColor={DISPLAY_STATUS_COLORS.reserved.bg} />
              <StatusOption picked={picked === 'rented'} onClick={() => setPicked('rented')} label="Rented" sub="Pick a customer and create the lease." dotColor={DISPLAY_STATUS_COLORS.rented.bg} disabled={hasActiveTenant} disabledNote={hasActiveTenant ? 'Already rented — release first.' : undefined} />
              <StatusOption picked={picked === 'maintenance'} onClick={() => setPicked('maintenance')} label="Maintenance" sub="Block the unit from new rentals." dotColor={DISPLAY_STATUS_COLORS.unavailable.bg} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Delinquency / collections</p>
            <p className="mb-2 text-xs text-gray-500">Requires an active tenant on this unit.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <StatusOption picked={picked === 'mark_late'} onClick={() => setPicked('mark_late')} label="Late" sub="Backdates an unpaid rent (~5 days past due)." dotColor={DISPLAY_STATUS_COLORS.late.bg} disabled={!hasActiveTenant} />
              <StatusOption picked={picked === 'mark_pre_lien'} onClick={() => setPicked('mark_pre_lien')} label="Pre-Lien" sub="Backdates an unpaid rent (~32 days past due)." dotColor={DISPLAY_STATUS_COLORS.pre_lien.bg} disabled={!hasActiveTenant} />
              <StatusOption picked={picked === 'mark_lien'} onClick={() => setPicked('mark_lien')} label="Lien" sub="Backdates an unpaid rent (~62 days past due)." dotColor={DISPLAY_STATUS_COLORS.lien.bg} disabled={!hasActiveTenant} />
              <StatusOption picked={picked === 'lock_out'} onClick={() => setPicked('lock_out')} label="Lock Out" sub="Past due + revoke gate access." dotColor={DISPLAY_STATUS_COLORS.locked_out.bg} disabled={!hasActiveTenant} />
              <StatusOption picked={picked === 'auction'} onClick={() => setPicked('auction')} label="Schedule Auction" sub="Pick a date to send the unit to auction." dotColor={DISPLAY_STATUS_COLORS.auction.bg} disabled={!hasActiveTenant} />
            </div>
          </div>

          {picked === 'auction' && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-700" htmlFor="auctionDate">
                Auction date
              </label>
              <input
                type="date"
                id="auctionDate"
                value={auctionDate}
                onChange={(e) => setAuctionDate(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-olive focus:outline-none"
              />
            </div>
          )}

          {picked === 'available' && hasActiveTenant && (
            <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
              <strong>Heads up:</strong> this will end the current lease and clear the customer&apos;s assignment.
              The tenant record stays — only the link to this unit is removed.
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!picked || submitting}
            className="rounded bg-olive px-4 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Working…' : picked === 'rented' ? 'Continue →' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function StatusOption({
  picked, onClick, label, sub, dotColor, disabled, disabledNote,
}: {
  picked: boolean
  onClick: () => void
  label: string
  sub: string
  dotColor: string
  disabled?: boolean
  disabledNote?: string
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex items-start gap-3 rounded border p-3 text-left transition-colors ${
        picked
          ? 'border-olive bg-olive/5 ring-1 ring-olive'
          : disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50'
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
    >
      <span className="mt-1 h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-600">{disabledNote ?? sub}</span>
      </span>
    </button>
  )
}
