'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Unit {
  _id: string
  unitNumber: string
  size: string
  sqft: number
  type: string
  price: number
}

interface ChargeLine {
  label: string
  amount: number
  type: string
  description?: string
}

export interface ChargeBreakdown {
  dueToday: { lines: ChargeLine[]; total: number }
  futureCharge: { dueDate: string; lines: ChargeLine[]; total: number } | null
  recurring: {
    startDate: string
    lines: ChargeLine[]
    total: number
    promoNote?: string
  }
  appliedPromotion?: { id: string; name: string; description: string } | null
  appliedProtectionPlan?: { id: string; name: string; monthlyPrice: number; coverageAmount: number } | null
  promoCodeError?: string | null
}

interface ProtectionPlan {
  _id: string
  name: string
  monthlyPrice: number
  coverageAmount: number
  description: string
  displayOrder: number
}

interface FacilityInfo {
  facilityName: string
  facilityPhone: string
}

interface ReserveSidebarProps {
  unit: Unit
  signDate: Date
  protectionPlanId: string | null
  onProtectionPlanChange: (id: string | null) => void
  onChargesUpdate: (breakdown: ChargeBreakdown) => void
  facility: FacilityInfo
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (d: string | Date | undefined) => {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReserveSidebar({
  unit,
  signDate,
  protectionPlanId,
  onProtectionPlanChange,
  onChargesUpdate,
  facility,
}: ReserveSidebarProps) {
  const [plans, setPlans] = useState<ProtectionPlan[]>([])
  const [breakdown, setBreakdown] = useState<ChargeBreakdown | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChargesUpdateRef = useRef(onChargesUpdate)

  useEffect(() => { onChargesUpdateRef.current = onChargesUpdate }, [onChargesUpdate])

  // Load active protection plans
  useEffect(() => {
    fetch('/api/protection-plans?public=1')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) setPlans(json.data)
      })
      .catch(() => {})
  }, [])

  const calculate = useCallback(async () => {
    setCalculating(true)
    setError(null)
    try {
      const res = await fetch('/api/public/calculate-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit._id,
          signDate: signDate.toISOString(),
          protectionPlanId: protectionPlanId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not calculate charges')
        return
      }
      const data = json.data as ChargeBreakdown
      setBreakdown(data)
      onChargesUpdateRef.current(data)
    } catch {
      setError('Could not calculate charges')
    } finally {
      setCalculating(false)
    }
  }, [unit._id, signDate, protectionPlanId])

  // Debounced recalculation when inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { calculate() }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [calculate])

  return (
    <aside className="lg:sticky lg:top-24 space-y-4">
      {/* ─── Unit summary ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-mid bg-white shadow-sm overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="w-14 h-14 rounded-lg bg-tan/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-tan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-2m-12 0h2m-2 0H3m6-9h6m-6-4h6m-6 8h6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-serif text-lg font-bold text-brown">{unit.size}</p>
              <p className="text-sm font-semibold text-brown whitespace-nowrap">{fmt(unit.price)}</p>
            </div>
            <p className="text-xs text-muted mt-0.5">Unit {unit.unitNumber}</p>
          </div>
        </div>
        <div className="border-t border-mid bg-cream px-4 py-3">
          <p className="text-xs text-brown font-medium">{facility.facilityName}</p>
          <p className="text-xs text-muted">{facility.facilityPhone}</p>
          <Link href="/units" className="inline-block mt-2 text-xs text-tan hover:underline font-medium">
            Change unit →
          </Link>
        </div>
      </div>

      {/* ─── Protection plan ──────────────────────────────────────────── */}
      {plans.length > 0 && (
        <div className="rounded-xl border border-mid bg-white shadow-sm p-4">
          <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brown mb-2">
            Protection Plan
            <span className="text-muted normal-case font-normal text-[10px]" title="Coverage tier">(coverage tier)</span>
          </label>
          <select
            value={protectionPlanId ?? ''}
            onChange={(e) => onProtectionPlanChange(e.target.value || null)}
            className="w-full rounded border border-mid px-3 py-2 text-sm text-brown bg-white focus:border-tan focus:outline-none focus:ring-1 focus:ring-tan/30"
          >
            <option value="">No protection</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — {fmt(p.monthlyPrice)}/mo
              </option>
            ))}
          </select>
          {protectionPlanId && breakdown?.appliedProtectionPlan && (
            <p className="mt-2 text-xs text-muted">
              {fmt(breakdown.appliedProtectionPlan.coverageAmount)} coverage
            </p>
          )}
        </div>
      )}

      {/* ─── Charges ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-mid bg-white shadow-sm p-4">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        {/* Due Today */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-2">Due Today</p>
          {!breakdown ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-mid/40 rounded animate-pulse" />
              <div className="h-3 bg-mid/40 rounded animate-pulse w-3/4" />
            </div>
          ) : (
            <>
              {breakdown.dueToday.lines.map((line, i) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span className={line.type === 'promotion' ? 'text-red-600' : 'text-brown/80'}>
                    {line.label}
                  </span>
                  <span className={line.type === 'promotion' ? 'text-red-600' : 'text-brown'}>
                    {line.amount < 0 ? `-${fmt(Math.abs(line.amount))}` : fmt(line.amount)}
                  </span>
                </div>
              ))}
              <div className="border-t border-mid mt-2 pt-2 flex justify-between font-bold">
                <span className="text-brown">Total</span>
                <span className="text-brown text-base">{fmt(breakdown.dueToday.total)}</span>
              </div>
            </>
          )}
        </div>

        {/* Future Charge */}
        {breakdown?.futureCharge && (
          <div className="mb-4 pt-4 border-t border-mid">
            <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-1">Future Charge</p>
            <p className="text-xs text-muted mb-2">
              Prorated period due on {fmtDate(breakdown.futureCharge.dueDate)}
            </p>
            {breakdown.futureCharge.lines.map((line, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5">
                <span className="text-brown/80">{line.label}</span>
                <span className="text-brown">{fmt(line.amount)}</span>
              </div>
            ))}
            <div className="border-t border-mid mt-2 pt-2 flex justify-between font-semibold">
              <span className="text-brown">Total</span>
              <span className="text-brown">{fmt(breakdown.futureCharge.total)}</span>
            </div>
          </div>
        )}

        {/* Recurring */}
        {breakdown?.recurring && (
          <div className="pt-4 border-t border-mid">
            <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-2">
              Starting {fmtDate(breakdown.recurring.startDate)}
            </p>
            {breakdown.recurring.lines.map((line, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5">
                <span className={line.type === 'promotion' ? 'text-red-600' : 'text-brown/80'}>
                  {line.label}
                </span>
                <span className={line.type === 'promotion' ? 'text-red-600' : 'text-brown'}>
                  {line.amount < 0 ? `-${fmt(Math.abs(line.amount))}` : fmt(line.amount)}
                </span>
              </div>
            ))}
            <div className="border-t border-mid mt-2 pt-2 flex justify-between font-semibold">
              <span className="text-brown">Monthly Total</span>
              <span className="text-brown">{fmt(breakdown.recurring.total)}</span>
            </div>
            {breakdown.recurring.promoNote && (
              <p className="mt-2 text-xs text-muted italic">{breakdown.recurring.promoNote}</p>
            )}
          </div>
        )}

        {calculating && breakdown && (
          <p className="text-[10px] text-muted text-center mt-2">Updating…</p>
        )}
      </div>
    </aside>
  )
}
