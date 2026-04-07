import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Tuscany Village Self Storage | Florence, SC',
    template: '%s | Tuscany Village Self Storage',
  },
  description:
    'Safe, clean, and affordable storage units in Florence, SC. Climate-controlled, drive-up, and vehicle storage available. Reserve online today.',
  keywords: ['self storage', 'Florence SC', 'storage units', 'climate controlled storage', 'storage near me'],
  authors: [{ name: 'Tuscany Village Self Storage' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'Tuscany Village Self Storage',
    description: 'Safe, clean, and affordable storage in Florence, SC.',
    type: 'website',
    locale: 'en_US',
  },
}

export const viewport: Viewport = {
  themeColor: '#1C0F06',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable}`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TuscanyStorage" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              '@id': 'https://tuscanystorage.com',
              name: 'Tuscany Village Self Storage',
              description:
                'Safe, clean, and affordable storage units in Florence, SC. Climate-controlled, drive-up, and vehicle storage available.',
              url: 'https://tuscanystorage.com',
              telephone: '+1-843-555-0100',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '1234 Tuscany Blvd',
                addressLocality: 'Florence',
                addressRegion: 'SC',
                postalCode: '29501',
                addressCountry: 'US',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: 34.1954,
                longitude: -79.7626,
              },
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                  opens: '09:00',
                  closes: '18:00',
                },
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: 'Saturday',
                  opens: '09:00',
                  closes: '14:00',
                },
              ],
              image: 'https://tuscanystorage.com/images/facility.jpg',
              priceRange: '$$',
              sameAs: [],
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
