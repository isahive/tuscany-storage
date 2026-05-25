import WaitingListForm from './WaitingListForm'

const SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '5x10', label: '5 x 10' },
  { value: '10x10', label: '10 x 10' },
  { value: '10x15', label: '10 x 15' },
  { value: '10x20', label: '10 x 20' },
  { value: '10x30', label: '10 x 30' },
  { value: '10x30_vehicle', label: 'Boat, RV, Camper & Trailer - Open Air (10 x 30)' },
]

function labelForSize(value: string | undefined): string {
  if (!value) return '10 x 10'
  return SIZE_OPTIONS.find((s) => s.value === value)?.label ?? '10 x 10'
}

export default function WaitingListPage({
  searchParams,
}: {
  searchParams?: { size?: string }
}) {
  const sizeFromUrl = searchParams?.size
  const knownSize = SIZE_OPTIONS.find((s) => s.value === sizeFromUrl)?.value
  const defaultSize = knownSize ?? '10x10'
  const displayLabel = labelForSize(defaultSize)

  return (
    <div className="bg-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-semibold text-gray-900">Join the Waiting List</h1>

          <p className="mt-6 text-base text-gray-800">
            There are currently no <strong>{displayLabel}</strong> units available.
          </p>
          <p className="mt-2 text-base text-gray-800">
            Fill out this form and we&apos;ll let you know as soon as something becomes available.
          </p>

          <div className="mt-6">
            <WaitingListForm
              defaultSize={defaultSize}
              sizeOptions={SIZE_OPTIONS}
              turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
