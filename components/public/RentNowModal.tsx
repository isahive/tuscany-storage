'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type AvailableUnit = { _id: string; unitNumber: string }

type Props = {
  open: boolean
  onClose: () => void
  sizeLabel: string
  image: string
  originalPriceCents: number
  currentPriceCents: number
  promoText?: string
  availableUnits: AvailableUnit[]
}

function formatMoney(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars)
    ? `$${dollars}.00`
    : `$${dollars.toFixed(2)}`
}

export default function RentNowModal({
  open,
  onClose,
  sizeLabel,
  image,
  originalPriceCents,
  currentPriceCents,
  promoText,
  availableUnits,
}: Props) {
  const router = useRouter()
  const [selectedUnitId, setSelectedUnitId] = useState<string>('auto')

  // Reset when reopened
  useEffect(() => {
    if (open) setSelectedUnitId('auto')
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  if (!open) return null

  const hasPromo = currentPriceCents !== originalPriceCents

  function handleRentNow() {
    const target =
      selectedUnitId === 'auto' ? availableUnits[0]?._id : selectedUnitId
    if (!target) return
    router.push(`/reserve/${target}`)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rent-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="rent-modal-title" className="text-2xl font-semibold text-gray-900">
            {sizeLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {/* Image */}
          <div className="flex justify-center">
            <Image
              src={image}
              alt={`${sizeLabel} unit illustration`}
              width={240}
              height={180}
              className="h-auto w-44 object-contain"
            />
          </div>

          {/* Payment options */}
          <p className="mt-6 font-semibold text-gray-900">Payment options</p>
          <label className="mt-2 flex flex-col items-center gap-2 rounded-md border border-gray-200 bg-white p-5 cursor-pointer">
            <input type="radio" name="payment-option" defaultChecked className="h-5 w-5 accent-olive" />
            <span className="text-sm font-medium text-gray-700">1 Month for</span>
            <div className="flex items-baseline gap-2">
              {hasPromo && (
                <span className="text-gray-400 line-through">
                  {formatMoney(originalPriceCents)}
                </span>
              )}
              <span className="text-2xl font-semibold text-gray-900">
                {formatMoney(currentPriceCents)}
              </span>
            </div>
            <span className="mt-1 text-sm font-semibold text-gray-700">
              {formatMoney(currentPriceCents)} / month
            </span>
          </label>

          {/* Promo banner */}
          {promoText && (
            <p className="mt-4 rounded bg-[#FFF7D6] px-4 py-3 text-sm text-gray-800">
              {promoText}
            </p>
          )}

          {/* Select unit */}
          <div className="mt-5">
            <label htmlFor="select-unit" className="block font-semibold text-gray-900">
              Select unit
            </label>
            <select
              id="select-unit"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
            >
              <option value="auto">Automatically Select</option>
              {availableUnits.map((u) => (
                <option key={u._id} value={u._id}>
                  Unit {u.unitNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-olive/70 px-5 py-2 font-semibold text-white hover:bg-olive transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleRentNow}
            disabled={availableUnits.length === 0}
            className="rounded bg-olive px-5 py-2 font-semibold text-white hover:bg-olive-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Rent Now
          </button>
        </div>
      </div>
    </div>
  )
}
