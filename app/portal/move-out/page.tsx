'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Rental {
  leaseId: string
  unitNumber: string
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function MoveOutPageInner() {
  const router = useRouter()
  const search = useSearchParams()
  const leaseIdParam = search.get('leaseId')

  const [rental, setRental] = useState<Rental | null>(null)
  const [loadingRental, setLoadingRental] = useState(true)
  const [moveOutDate, setMoveOutDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/dashboard')
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return
        const list: Array<{ leaseId: string; unitNumber: string; status: string }> = j.data?.rentals ?? []
        const match = leaseIdParam
          ? list.find((r) => r.leaseId === leaseIdParam)
          : list.find((r) => r.status === 'active') ?? list[0]
        if (match) setRental({ leaseId: match.leaseId, unitNumber: match.unitNumber })
      })
      .catch(() => {})
      .finally(() => setLoadingRental(false))
  }, [leaseIdParam])

  async function handleSubmit() {
    if (!rental) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/move-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId: rental.leaseId,
          requestedMoveOutDate: new Date(`${moveOutDate}T12:00:00`).toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to submit move-out request.')
      router.push('/portal?moveout=success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingRental) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  if (!rental) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          We couldn&apos;t find an active rental for your account. Please contact the facility.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <section className="rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-3 text-center">
          <h1 className="font-display text-xl font-semibold text-olive-darker">
            Request Move Out of Unit {rental.unitNumber}
          </h1>
        </header>

        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-gray-700">You can request a move out for today or in the future.</p>

          <div>
            <label htmlFor="moveOutDate" className="mb-1 block text-sm font-semibold text-gray-900">
              Select requested move out date
            </label>
            <input
              id="moveOutDate"
              type="date"
              min={todayISO()}
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-olive focus:outline-none"
            />
          </div>

          <p className="text-sm text-gray-700">
            The manager will receive an email with your requested move out date.
          </p>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !moveOutDate}
              className="rounded bg-olive px-5 py-2 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Request Move Out'}
            </button>
            <Link href="/portal" className="text-sm text-[#3E5DAA] underline hover:no-underline">
              Cancel
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function MoveOutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
        </div>
      }
    >
      <MoveOutPageInner />
    </Suspense>
  )
}
