'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import RentNowModal from './RentNowModal'

type GroupUnit = { _id: string; unitNumber: string; price: number; status: string; type: string }

type Props = {
  sizeKey: string
  label: string
  image: string
  units: GroupUnit[]
  originalPriceCents: number
  currentPriceCents: number
  hasPriceRange: boolean
  hasPromo: boolean
  promoText?: string
}

function formatMoney(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`
}

export default function SizeCard({
  sizeKey,
  label,
  image,
  units,
  originalPriceCents,
  currentPriceCents,
  hasPriceRange,
  hasPromo,
  promoText,
}: Props) {
  const [open, setOpen] = useState(false)
  const availableUnits = units
    .filter((u) => u.status === 'available')
    .map((u) => ({ _id: u._id, unitNumber: u.unitNumber }))
  const isAvailable = availableUnits.length > 0

  return (
    <article className="rounded border border-gray-200 bg-white p-6 shadow-sm">
      {/* Size title */}
      <h2 className="text-2xl font-semibold text-olive">{label}</h2>

      {/* Top row: image left, price right (baseline) */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex-shrink-0">
          <Image
            src={image}
            alt={`${label} unit illustration`}
            width={220}
            height={180}
            className="h-auto w-40 object-contain sm:w-48"
          />
        </div>

        <div className="flex flex-wrap items-baseline justify-end gap-2 text-base">
          {hasPriceRange && (
            <span className="mr-auto self-end text-sm text-gray-600">Starting at</span>
          )}
          {hasPromo && (
            <span className="text-gray-400 line-through">
              {formatMoney(originalPriceCents)}
            </span>
          )}
          <span className="text-2xl font-bold text-olive">
            {formatMoney(currentPriceCents)}
          </span>
          <span className="text-gray-700">/ month</span>
        </div>
      </div>

      {/* Promo banner — full width */}
      {promoText && (
        <p className="mt-5 rounded bg-[#FFF7D6] px-4 py-3 text-sm text-gray-800">
          {promoText}
        </p>
      )}

      {/* CTA */}
      <div className="mt-4 flex justify-end">
        {isAvailable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded bg-olive px-6 py-2 text-base font-semibold text-white shadow-sm hover:bg-olive-dark transition-colors duration-200"
          >
            Rent Now
          </button>
        ) : (
          <Link
            href={`/waiting-list?size=${encodeURIComponent(sizeKey)}`}
            className="rounded bg-olive/70 px-6 py-2 text-base font-semibold text-white shadow-sm hover:bg-olive transition-colors duration-200"
          >
            Waiting List
          </Link>
        )}
      </div>

      {/* Modal */}
      {isAvailable && (
        <RentNowModal
          open={open}
          onClose={() => setOpen(false)}
          sizeLabel={label}
          image={image}
          originalPriceCents={originalPriceCents}
          currentPriceCents={currentPriceCents}
          promoText={promoText}
          availableUnits={availableUnits}
        />
      )}
    </article>
  )
}
