'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatMoney, formatDate } from '@/lib/utils'

interface Rental {
  id: string
  tenantId: string | null
  tenantName: string
  startDate: string
  endDate: string | null
  monthlyRate: number
  status: 'active' | 'ended' | 'pending_moveout'
}

interface PaymentRow {
  id: string
  date: string
  tenantId: string | null
  tenantName: string
  type: string
  direction: 'charge' | 'payment'
  amount: number
  status: string
  description: string
}

interface HistoryData {
  unit: { unitNumber: string; size: string; type: string; status: string }
  rentals: Rental[]
  payments: PaymentRow[]
}

const LEASE_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-100 text-green-800' },
  pending_moveout: { label: 'Moving out', cls: 'bg-amber-100 text-amber-800' },
  ended: { label: 'Ended', cls: 'bg-gray-100 text-gray-600' },
}

const PAY_STATUS: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
  voided: 'bg-gray-100 text-gray-600',
}

const TYPE_LABEL: Record<string, string> = {
  rent: 'Rent', late_fee: 'Past Due Fee', deposit: 'Deposit',
  prorated: 'Prorated Rent', credit: 'Credit', other: 'Fee',
}

export default function UnitHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const unitId = params.id as string

  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/units/${unitId}/history`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load history')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{error ?? 'Unit not found'}</p>
        <button onClick={() => router.push(`/admin/units/${unitId}`)} className="mt-3 text-sm font-semibold text-olive-darker hover:underline">
          Back to unit
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => router.push(`/admin/units/${unitId}`)}
        className="mb-3 text-sm font-semibold text-gray-600 hover:text-olive-darker"
      >
        ← Back to Unit {data.unit.unitNumber}
      </button>
      <h1 className="font-display text-2xl font-semibold text-olive-darker">Unit {data.unit.unitNumber} — History</h1>
      <p className="mb-5 text-xs text-gray-500">{data.unit.size}</p>

      {/* Rentals */}
      <section className="mb-6 rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-2.5">
          <h2 className="font-display text-base font-semibold text-olive-darker">Rental history</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-900">
                <th className="px-4 py-2 font-semibold">Tenant</th>
                <th className="px-4 py-2 font-semibold">Started</th>
                <th className="px-4 py-2 font-semibold">Ended</th>
                <th className="px-4 py-2 text-right font-semibold">Rate</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rentals.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No rentals on record for this unit.</td></tr>
              ) : (
                data.rentals.map((r) => {
                  const s = LEASE_STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="px-4 py-2.5">
                        {r.tenantId ? (
                          <Link href={`/admin/tenants/${r.tenantId}`} className="font-semibold text-[#3E5DAA] hover:underline">{r.tenantName}</Link>
                        ) : r.tenantName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{formatDate(r.startDate)}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.endDate ? formatDate(r.endDate) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-900">{formatMoney(r.monthlyRate)}/mo</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payments */}
      <section className="rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-2.5">
          <h2 className="font-display text-base font-semibold text-olive-darker">Payment activity</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-900">
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-4 py-2 font-semibold">Tenant</th>
                <th className="px-4 py-2 font-semibold">Description</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No payment activity for this unit.</td></tr>
              ) : (
                data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{formatDate(p.date)}</td>
                    <td className="px-4 py-2.5">
                      {p.tenantId ? (
                        <Link href={`/admin/tenants/${p.tenantId}`} className="text-[#3E5DAA] hover:underline">{p.tenantName}</Link>
                      ) : p.tenantName}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{p.description || TYPE_LABEL[p.type] || p.type}</td>
                    <td className={`px-4 py-2.5 text-right ${p.direction === 'charge' ? 'text-gray-900' : 'text-green-700'}`}>
                      {p.direction === 'charge' ? '' : '−'}{formatMoney(Math.abs(p.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_STATUS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
