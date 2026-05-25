import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Tenant Protection',
  description:
    'Protect your stored belongings against burglary, vandalism, weather, fire, and more. Affordable monthly plans from $12.',
}

const PLANS: Array<{ coverage: string; price: string }> = [
  { coverage: '$2,000.00', price: '$12.00/month' },
  { coverage: '$3,000.00', price: '$15.00/month' },
  { coverage: '$5,000.00', price: '$20.00/month' },
  { coverage: '$10,000.00', price: '$33.00/month' },
  { coverage: '$15,000.00', price: '$42.00/month' },
]

const COVERED: string[] = [
  'Burglary/Vandalism',
  'Wind',
  'Lightning',
  'Hail',
  'Water (excluding flood)',
  'Fire',
  'Smoke',
  'Explosion',
  'Vermin (covered up to $500)',
  'Sinkhole',
  'Building Collapse',
]

export default function TenantProtectionPage() {
  return (
    <div className="bg-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Title */}
        <h1 className="text-center text-4xl font-semibold text-gray-900">
          Tenant Protection
        </h1>
        <p className="mt-5 text-center text-xl font-bold text-gray-900">
          Protect your storage against the unexpected!
        </p>

        {/* Why */}
        <div className="mt-10">
          <p className="text-base text-gray-900">
            We recommend Tenant Protection over homeowner&apos;s insurance because:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-8 text-base text-gray-900">
            <li>Your stored items may not be covered by your homeowner&apos;s policy</li>
            <li>Your premiums could go up if you file a claim</li>
            <li>Your homeowner&apos;s policy could be canceled if you file a claim</li>
          </ul>
        </div>

        {/* AVOID THE $200 DEDUCTIBLE — gray banner */}
        <div className="mt-10 flex flex-col items-center gap-6 rounded bg-gray-200 px-6 py-10 sm:flex-row sm:gap-8 sm:px-10">
          <div className="flex-shrink-0">
            <Image
              src="/images/tenant-protection/shield-lock.png"
              alt="Shield with disc lock"
              width={200}
              height={200}
              className="h-auto w-36 sm:w-44"
            />
          </div>
          <div className="flex-1 text-center">
            <h2 className="text-2xl font-bold tracking-wide text-gray-700 sm:text-3xl">
              AVOID THE $200 DEDUCTIBLE
            </h2>
            <p className="mt-4 text-base text-gray-700">
              Be sure to use a disc or cylinder lock to avoid the $200 deductible.
            </p>
          </div>
        </div>

        {/* Coverage Options */}
        <h2 className="mt-14 text-center text-3xl font-normal text-gray-700">Coverage Options</h2>

        <div className="mt-6 grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
          <p className="text-xl font-normal leading-snug text-gray-900">
            Add tenant protection when renting a unit or add to an existing rental through your
            online account.
          </p>

          <div className="overflow-hidden rounded border border-gray-300 bg-white">
            <table className="w-full border-collapse">
              <tbody>
                {PLANS.map((plan, idx) => (
                  <tr
                    key={plan.coverage}
                    className={idx > 0 ? 'border-t border-gray-300' : ''}
                  >
                    <td className="px-4 py-3 text-center text-base text-gray-900">{plan.coverage}</td>
                    <td className="border-l border-gray-300 px-4 py-3 text-center text-base text-gray-900">
                      {plan.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* What's Covered — gray banner */}
        <div className="mt-12 flex flex-col items-center gap-6 rounded bg-gray-200 px-6 py-10 sm:flex-row sm:items-start sm:gap-8 sm:px-10">
          <div className="flex-shrink-0">
            <Image
              src="/images/tenant-protection/checklist.png"
              alt="Checklist of covered items"
              width={220}
              height={220}
              className="h-auto w-36 sm:w-48"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">What&apos;s Covered?</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-base text-gray-900">
              {COVERED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* How to File a Claim */}
        <h2 className="mt-14 text-center text-3xl font-normal text-gray-700">How to File a Claim</h2>

        <div className="mt-6 grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12">
          <ol className="space-y-3 text-base leading-relaxed text-gray-900">
            <li>1. Notify the manager.</li>
            <li>
              2. Take photos of any damage to your items and the storage unit. Please take photos of
              the source of damage if possible. DO NOT throw anything away until you speak with a
              claims specialist.
            </li>
            <li>
              3.{' '}
              <a
                href="#"
                className="inline-flex items-center gap-1 text-[#3E5DAA] underline hover:no-underline"
              >
                Click here
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </a>{' '}
              to file your claim. For assistance, please call{' '}
              <a href="tel:+18336828879" className="text-[#3E5DAA] underline hover:no-underline">
                833-682-8879
              </a>
              .
            </li>
            <li>
              4. For claims involving crime, have a police officer visit the unit and file a police
              report.
            </li>
          </ol>

          <div className="flex flex-shrink-0 justify-center md:justify-end">
            <Image
              src="/images/tenant-protection/claim-form.png"
              alt="Claim form"
              width={200}
              height={200}
              className="h-auto w-36 sm:w-44"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
