'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface LineItem {
  id: string
  dateCreated: string
  type: string
  description: string
  amount: number
  tax: number
  due: number
  unitNumber: string | null
  dueDate: string | null
  periodStart: string | null
  periodEnd: string | null
}

interface UnitOption {
  unitId: string
  unitNumber: string
  size: string
}

interface StatementData {
  lineItems: LineItem[]
  units: UnitOption[]
  credit: number
  outstanding: number
  total: number
  balance: number
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  rent: 'Rent',
  late_fee: 'Past Due Fee',
  deposit: 'Security Deposit',
  prorated: 'Prorated',
  other: 'Fee',
}

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')
}

function itemDescription(item: LineItem): string {
  // Mirrors the live "Past Due Fee – Past Due Fee for unit G5 prorated rent
  // due on 5/1/2026 $20.00" layout: type label, dash, structured detail.
  const label = PAYMENT_TYPE_LABEL[item.type] ?? item.type
  if (item.description?.trim()) {
    return `${label} – ${item.description}`
  }
  const unitPart = item.unitNumber ? ` for unit ${item.unitNumber}` : ''
  // Rent is a monthly prepayment due on the 1st — show the due date (period
  // start / dueDate), not the period range, whose end is the last day of the
  // month and reads misleadingly like the rent is "due" then.
  const rentDue = item.dueDate ?? item.periodStart
  const periodPart = item.type === 'rent' && rentDue
    ? ` due on ${fmtDate(rentDue)}`
    : item.periodStart && item.periodEnd
    ? ` for ${fmtDate(item.periodStart)} to ${fmtDate(item.periodEnd)}`
    : item.dueDate
    ? ` due on ${fmtDate(item.dueDate)}`
    : ''
  return `${label}${unitPart}${periodPart} ${fmtMoney(item.amount)}`
}

export default function StatementPage() {
  const router = useRouter()
  const [data, setData] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portal/statement')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        if (json.data.units[0]) setSelectedUnitId(json.data.units[0].unitId)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
        <p className="text-gray-700">Unable to load your statement. Please refresh or contact support.</p>
      </div>
    )
  }

  const hasOutstanding = data.outstanding > 0
  const hasLineItems = data.lineItems.length > 0

  function handleDownload() {
    window.open('/api/portal/statement/pdf', '_blank', 'noopener,noreferrer')
  }

  function handleMakePayment() {
    router.push('/portal/payments/new')
  }

  function handlePrepay() {
    if (hasOutstanding) return
    router.push(`/portal/payments/new?prepay=1&unitId=${selectedUnitId}`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-3 text-center">
          <h1 className="font-display text-xl font-semibold text-olive-darker">Statement</h1>
        </header>

        <div className="px-6 py-5 text-sm text-gray-700">
          <p className="mb-3">Below is a list of invoiced LINE ITEMS that have not been paid.</p>
          <p className="mb-4">
            To Make A Partial Or Full Payment To Multiple Line Items At Once: Click on the &quot;Make a Payment&quot;
            button below the box.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-900">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Description</th>
                  <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-4 text-right font-semibold">Tax</th>
                  <th className="py-2 text-right font-semibold">Due</th>
                </tr>
              </thead>
              <tbody>
                {!hasLineItems && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      You have no unpaid line items.
                    </td>
                  </tr>
                )}

                {data.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 align-top">
                    <td className="whitespace-nowrap py-3 pr-4 text-gray-700">
                      <div>{fmtDate(item.dateCreated)}</div>
                      <div className="text-xs text-gray-500">{fmtTime(item.dateCreated)}</div>
                    </td>
                    <td className="py-3 pr-4 text-gray-800">{itemDescription(item)}</td>
                    <td className="py-3 pr-4 text-right text-gray-800">{fmtMoney(item.amount)}</td>
                    <td className="py-3 pr-4 text-right text-gray-800">{fmtMoney(item.tax)}</td>
                    <td className="py-3 text-right text-gray-900">{fmtMoney(item.due)}</td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={3}></td>
                  <td className="pt-4 pr-4 text-right text-gray-700">Credit:</td>
                  <td className="pt-4 text-right text-gray-900">{fmtMoney(data.credit)}</td>
                </tr>
                <tr>
                  <td colSpan={3}></td>
                  <td className="pt-2 pr-4 text-right font-semibold text-gray-900">Total:</td>
                  <td className="pt-2 text-right font-bold text-gray-900">{fmtMoney(data.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-900" htmlFor="prepay-unit">
                Prepay For
              </label>
              <select
                id="prepay-unit"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={data.units.length === 0}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-olive focus:outline-none disabled:bg-gray-100"
              >
                {data.units.length === 0 ? (
                  <option value="">No active units</option>
                ) : (
                  data.units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      Unit {u.unitNumber}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={handlePrepay}
                disabled={hasOutstanding || data.units.length === 0}
                className="rounded bg-olive px-4 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prepay
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="rounded bg-olive px-4 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark"
              >
                Download
              </button>
              <button
                type="button"
                onClick={handleMakePayment}
                disabled={!hasLineItems}
                className="rounded bg-olive px-4 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Make a Payment
              </button>
            </div>
          </div>

          {hasOutstanding && (
            <p className="mt-3 text-sm text-gray-600">
              Pre-payments are not allowed when there is an outstanding balance.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
