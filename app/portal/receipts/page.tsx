'use client'

import { useCallback, useEffect, useState } from 'react'

interface PaymentRow {
  _id: string
  createdAt: string
  amount: number
  status: string
  direction: 'charge' | 'payment'
  type?: string
  description?: string
}

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function paymentLabel(p: PaymentRow): string {
  if (p.description?.trim()) return p.description
  return 'Payment'
}

export default function ReceiptsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  // id currently sending → channel, so we can disable just that row's buttons
  const [sending, setSending] = useState<{ id: string; channel: 'email' | 'sms' } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portal/payments')
      const json = await res.json()
      if (json.success) {
        const paid: PaymentRow[] = (json.data as PaymentRow[]).filter(
          (p) => p.direction === 'payment' && p.status === 'succeeded' && p.amount > 0,
        )
        setRows(paid)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function resend(id: string, channel: 'email' | 'sms') {
    setSending({ id, channel })
    setMessage(null)
    try {
      const res = await fetch(`/api/portal/payments/${id}/resend-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Could not send receipt')
      setMessage({ kind: 'ok', text: channel === 'email' ? 'Receipt sent to your email.' : 'Receipt sent by text.' })
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could not send receipt' })
    } finally {
      setSending(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-3 text-center">
          <h1 className="font-display text-xl font-semibold text-olive-darker">Payment History &amp; Receipts</h1>
        </header>

        <div className="px-6 py-5 text-sm text-gray-700">
          <p className="mb-4">Your completed payments. Resend a receipt to your email or phone anytime.</p>

          {message && (
            <div
              className={`mb-4 rounded border px-4 py-2 text-sm ${
                message.kind === 'ok'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-900">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Description</th>
                  <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                  <th className="py-2 text-right font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      You have no completed payments yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => {
                    const busy = sending?.id === p._id
                    return (
                      <tr key={p._id} className="border-b border-gray-100 align-top">
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-700">{fmtDate(p.createdAt)}</td>
                        <td className="py-3 pr-4 text-gray-800">{paymentLabel(p)}</td>
                        <td className="py-3 pr-4 text-right text-gray-900">{fmtMoney(p.amount)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => resend(p._id, 'email')}
                              disabled={busy}
                              className="rounded border border-olive px-3 py-1 text-xs font-semibold text-olive-darker hover:bg-olive/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy && sending?.channel === 'email' ? 'Sending…' : 'Email'}
                            </button>
                            <button
                              type="button"
                              onClick={() => resend(p._id, 'sms')}
                              disabled={busy}
                              className="rounded border border-olive px-3 py-1 text-xs font-semibold text-olive-darker hover:bg-olive/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy && sending?.channel === 'sms' ? 'Sending…' : 'Text'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
