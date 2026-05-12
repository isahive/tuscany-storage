import Link from 'next/link'
import Image from 'next/image'

const APPOINTMENT_HOURS = [
  { day: 'Monday',    hours: 'By Appointment' },
  { day: 'Tuesday',   hours: 'By Appointment' },
  { day: 'Wednesday', hours: 'By Appointment' },
  { day: 'Thursday',  hours: 'By Appointment' },
  { day: 'Friday',    hours: 'By Appointment' },
  { day: 'Saturday',  hours: 'By Appointment' },
  { day: 'Sunday',    hours: 'By Appointment' },
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
            <a
              href="https://www.yelp.com/biz/tuscany-village-self-storage-caryville"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors duration-200"
            >
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.111 18.226c-.141.974-2.185 3.349-3.126 3.617-.328.094-.606.043-.826-.156-.14-.13-2.606-3.946-2.606-3.946a1.067 1.067 0 0 1-.07-.157c-.134-.476.217-.908.733-.965l4.755-.41c.547-.047.991.39.991.975 0 .014-.001.028-.004.04l.153 1.002zm-6.742 4.242c-.43.874-3.139 2.407-4.112 2.316-.34-.032-.59-.191-.734-.459-.088-.167-.767-4.576-.767-4.576a.954.954 0 0 1-.009-.157c.008-.492.48-.868 1.005-.851l4.741.536c.543.062.899.566.784 1.133l-.908 2.058zm-6.89-1.24c-.77.604-3.83.45-4.683-.16-.302-.217-.443-.512-.404-.851.025-.213 1.884-4.319 1.884-4.319.073-.141.151-.26.245-.353.364-.359.927-.328 1.284.073l3.076 3.566c.352.41.313 1.044-.092 1.42l-1.31.624zm-4.37-7.217c-.912-.462-1.875-3.406-1.601-4.329.097-.327.303-.548.595-.639.183-.057 4.648-.404 4.648-.404.156-.01.302-.006.429.018.508.096.81.596.682 1.124l-1.238 4.603c-.138.514-.676.801-1.207.65l-2.308-1.023zm6.284-7.02c.111-.997 2.295-3.246 3.253-3.465.334-.077.614-.016.826.193.133.131 2.414 4.04 2.414 4.04.076.133.134.264.16.395.104.481-.266.912-.79.954l-4.757.24c-.549.027-.987-.408-.972-.993.001-.013.003-.026.004-.039l-.138-1.325z"/>
              </svg>
              Book Online
            </a>
          </div>

          {/* Right — appointment hours */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              We are a fully automated company.
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
          <p className="text-center text-xs text-white/50">
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
