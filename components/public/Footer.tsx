import Link from 'next/link'
import Image from 'next/image'

const APPOINTMENT_HOURS = [
  { day: 'Monday',    hours: '9:00 AM – 5:00 PM' },
  { day: 'Tuesday',   hours: '9:00 AM – 5:00 PM' },
  { day: 'Wednesday', hours: '9:00 AM – 5:00 PM' },
  { day: 'Thursday',  hours: '9:00 AM – 5:00 PM' },
  { day: 'Friday',    hours: '9:00 AM – 5:00 PM' },
  { day: 'Saturday',  hours: '10:00 AM – 2:00 PM' },
  { day: 'Sunday',    hours: 'Closed' },
]

export default function Footer() {
  return (
    <footer className="bg-olive text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">

          {/* Left — brand + contact */}
          <div className="space-y-5">
            <Image
              src="/images/brand/logo.png"
              alt="Tuscany Village Self Storage"
              width={200}
              height={65}
              className="h-14 w-auto object-contain"
            />
            <div className="space-y-1.5 text-sm text-white/80">
              <p className="font-semibold text-white">Tuscany Village Self Storage</p>
              <p>2519 Highway 116</p>
              <p>Caryville, TN 37714</p>
            </div>
            <div className="space-y-2 text-sm text-white/80">
              <a
                href="tel:+18654262100"
                className="flex items-center gap-2 hover:text-white transition-colors duration-200"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (865) 426-2100
              </a>
              <a
                href="mailto:Tuscanystorage@gmail.com"
                className="flex items-center gap-2 hover:text-white transition-colors duration-200"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Tuscanystorage@gmail.com
              </a>
            </div>
            <div className="text-sm text-white/80">
              <p className="font-semibold text-white">Gate Access</p>
              <p>24 hours / 7 days a week</p>
            </div>
          </div>

          {/* Right — appointment hours */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Office Hours (By Appointment)
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {APPOINTMENT_HOURS.map(({ day, hours }) => (
                  <tr key={day} className="border-b border-white/10 last:border-0">
                    <td className="py-2 pr-6 font-medium text-white">{day}</td>
                    <td className="py-2 text-white/75">{hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-white/20 pt-6">
          <div className="flex flex-col items-center justify-between gap-3 text-xs text-white/60 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} Tuscany Village Self Storage. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <Link href="/privacy" className="hover:text-white transition-colors duration-200">
                Privacy Policy
              </Link>
              <span className="text-white/30">&middot;</span>
              <Link href="/terms" className="hover:text-white transition-colors duration-200">
                Terms of Service
              </Link>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-white/50 sm:text-right">
            Powered by{' '}
            <a
              href="https://storableeasy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white transition-colors duration-200"
            >
              Storable Easy
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
