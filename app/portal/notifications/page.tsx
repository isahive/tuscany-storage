'use client'

import { useCallback, useEffect, useState } from 'react'

interface NotificationRow {
  id: string
  type: string
  channel: 'email' | 'sms' | 'both'
  subject: string
  preview: string
  date: string
  opened: boolean
  delivered: boolean
}

const TYPE_LABEL: Record<string, string> = {
  payment_reminder: 'Payment Reminder',
  payment_confirmation: 'Payment Confirmation',
  payment_failed: 'Payment Failed',
  late_notice: 'Past Due Notice',
  lockout_notice: 'Lockout Notice',
  gate_code_changed: 'Gate Code Updated',
  move_in_confirmation: 'Move-In Confirmation',
  move_out_confirmation: 'Move-Out Confirmation',
  rate_change_notice: 'Rate Change Notice',
  waiting_list_available: 'Unit Available',
  custom: 'Message',
}

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  sms: 'Text',
  both: 'Email & Text',
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portal/notifications')
      const json = await res.json()
      if (json.success) setRows(json.data as NotificationRow[])
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

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-3 text-center">
          <h1 className="font-display text-xl font-semibold text-olive-darker">Notifications</h1>
        </header>

        <div className="px-4 py-4 sm:px-6">
          <p className="mb-4 text-sm text-gray-700">
            Emails and text messages we&rsquo;ve sent you, newest first.
          </p>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">You have no notifications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((n) => (
                <li key={n.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-olive/10 px-2.5 py-0.5 text-xs font-semibold text-olive-darker">
                      {TYPE_LABEL[n.type] ?? 'Message'}
                    </span>
                    <span className="text-xs text-gray-500">{fmtDateTime(n.date)}</span>
                  </div>

                  {n.subject && (
                    <p className="mt-1.5 text-sm font-semibold text-gray-900">{n.subject}</p>
                  )}
                  {n.preview && (
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{n.preview}</p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span>{CHANNEL_LABEL[n.channel] ?? n.channel}</span>
                    {n.opened ? (
                      <span className="text-green-600">· Opened</span>
                    ) : n.delivered ? (
                      <span className="text-gray-500">· Delivered</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
