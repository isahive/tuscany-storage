import Link from 'next/link'

const APPOINTMENT_HOURS = [
  { day: 'Sunday',    hours: 'By Appointment' },
  { day: 'Monday',    hours: 'By Appointment' },
  { day: 'Tuesday',   hours: 'By Appointment' },
  { day: 'Wednesday', hours: 'By Appointment' },
  { day: 'Thursday',  hours: 'By Appointment' },
  { day: 'Friday',    hours: 'By Appointment' },
  { day: 'Saturday',  hours: 'By Appointment' },
]

export default function Footer() {
  return (
    <footer className="bg-olive text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {/* 3-col grid: left contact | center Yelp | right hours */}
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-3 md:gap-8">

          {/* Left — Contact Us */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold text-white">Contact Us</h3>

            <div className="space-y-1 text-sm text-white">
              <p className="font-semibold">Tuscany Village Self Storage</p>
              <p>2519 Highway 116</p>
              <p>Caryville, TN 37714</p>
            </div>

            <div className="space-y-2 text-sm">
              <a
                href="tel:+18654262100"
                className="flex items-center gap-2 text-[#3E5DAA] underline hover:no-underline"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (865) 426-2100
              </a>
              <a
                href="mailto:Tuscanystorage@gmail.com"
                className="flex items-center gap-2 text-[#3E5DAA] underline hover:no-underline"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Tuscanystorage@gmail.com
              </a>
            </div>

            <Link
              href="/units"
              className="inline-block pt-2 text-base font-semibold text-white hover:opacity-80"
            >
              Book Online
            </Link>
          </div>

          {/* Center — Yelp link (Font Awesome official brand icon) */}
          <div className="flex justify-center">
            <a
              href="https://www.yelp.com/biz/tuscany-village-self-storage-caryville"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Find us on Yelp"
              className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              {/* Font Awesome Yelp brand icon */}
              <svg
                className="h-9 w-9 sm:h-10 sm:w-10"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 384 512"
                fill="white"
                aria-hidden="true"
              >
                <path d="M42.9 240.32l99.62 48.61c19.2 9.4 16.2 37.51-4.5 42.71L30.5 358.45a22.79 22.79 0 0 1-28.21-19.6 197.16 197.16 0 0 1 9-85.32 22.8 22.8 0 0 1 31.61-13.21zm44 239.25a199.45 199.45 0 0 0 79.42 32.11A22.78 22.78 0 0 0 192.94 490l3.9-110.82c.7-21.3-25.5-31.91-39.81-16.1l-74.21 82.4a22.82 22.82 0 0 0 4.09 34.09zm145.34-109.92l58.81 94a22.93 22.93 0 0 0 34 5.5 198.36 198.36 0 0 0 52.71-67.61A23 23 0 0 0 364.17 370l-105.42-34.26c-20.31-6.5-37.81 15.8-26.51 33.91zm148.33-132.23a197.44 197.44 0 0 0-50.41-69.31 22.85 22.85 0 0 0-34 4.4l-62 91.92c-11.9 17.7 4.7 40.61 25.2 34.71L366 268.63a23 23 0 0 0 14.61-31.21zM62.11 30.18a22.86 22.86 0 0 0-9.9 32l104.12 180.44c11.7 20.2 42.61 11.9 42.61-11.4V22.88a22.67 22.67 0 0 0-24.9-22.8 320.32 320.32 0 0 0-111.93 30.1z" />
              </svg>
            </a>
          </div>

          {/* Right — appointment hours */}
          <div>
            <h3 className="mb-4 text-base font-bold text-white">
              We are a fully automated company.
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {APPOINTMENT_HOURS.map(({ day, hours }) => (
                  <tr key={day}>
                    <td className="py-1 pr-6 text-white">{day}</td>
                    <td className="py-1 text-white">{hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom bar — legal links */}
      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-white/70 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Tuscany Village Self Storage. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/privacy" className="underline-offset-2 hover:text-white hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline-offset-2 hover:text-white hover:underline">
              Terms of Service
            </Link>
            <Link href="/accessibility" className="underline-offset-2 hover:text-white hover:underline">
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
