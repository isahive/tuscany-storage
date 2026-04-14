import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans, Outfit, Inter, Work_Sans, Poppins, Open_Sans, Plus_Jakarta_Sans } from 'next/font/google'
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

// ── Font options to test (switch ACTIVE_FONTS below) ──────────────
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-work-sans', display: 'swap' })
const poppins = Poppins({ subsets: ['latin'], variable: '--font-poppins', display: 'swap', weight: ['300', '400', '500', '600', '700'] })
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-plus-jakarta', display: 'swap' })

// ▼▼▼ CHANGE THIS TO TEST DIFFERENT COMBOS ▼▼▼
// Options:
//   1: Outfit (headings) + Inter (body)
//   2: Poppins (headings) + Open Sans (body)
//   3: Plus Jakarta Sans (both)
//   0: Original — Playfair Display + DM Sans
const ACTIVE_FONTS = 1
// ▲▲▲ CHANGE THIS TO TEST DIFFERENT COMBOS ▲▲▲

export const metadata: Metadata = {
  title: {
    default: 'Tuscany Village Self Storage | Caryville, TN',
    template: '%s | Tuscany Village Self Storage',
  },
  description:
    'Safe, clean, and affordable storage units in Caryville, TN. Climate-controlled, drive-up, and vehicle storage available. Reserve online today.',
  keywords: ['self storage', 'Caryville TN', 'storage units', 'climate controlled storage', 'storage near me'],
  authors: [{ name: 'Tuscany Village Self Storage' }],
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://tuscanystorage.com',
    siteName: 'Tuscany Village Self Storage',
    title: 'Tuscany Village Self Storage | Caryville, TN',
    description: 'Storage Units, Boat, Camper, RV & Trailer Storage in RockyTop/Caryville, TN 37714. Fully automated, 24/7 gate access.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tuscany Village Self Storage',
    description: 'Storage Units, Boat, Camper, RV & Trailer Storage in Caryville, TN',
  },
  alternates: {
    canonical: 'https://tuscanystorage.com',
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
      className={
        ACTIVE_FONTS === 1 ? `${outfit.variable} ${inter.variable}` :
        ACTIVE_FONTS === 2 ? `${poppins.variable} ${openSans.variable}` :
        ACTIVE_FONTS === 3 ? `${plusJakarta.variable} ${plusJakarta.variable}` :
        `${playfair.variable} ${dmSans.variable}`
      }
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
                'Safe, clean, and affordable storage units in Caryville, TN. Climate-controlled, drive-up, and vehicle storage available.',
              url: 'https://tuscanystorage.com',
              telephone: '+1-865-426-2100',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '2519 Highway 116',
                addressLocality: 'Caryville',
                addressRegion: 'TN',
                postalCode: '37714',
                addressCountry: 'US',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: 36.297,
                longitude: -84.223,
              },
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                  opens: '00:00',
                  closes: '23:59',
                  description: 'Gate access 24/7',
                },
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                  opens: '09:00',
                  closes: '17:00',
                  description: 'Office by appointment only',
                },
              ],
              image: 'https://tuscanystorage.com/images/facility.jpg',
              priceRange: '$$',
              sameAs: ['https://tuscanystorage.com'],
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Storage Services',
                itemListElement: [
                  {
                    '@type': 'OfferCatalog',
                    name: 'Standard Storage Units',
                    itemListElement: [
                      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Standard Storage Units' } },
                    ],
                  },
                  {
                    '@type': 'OfferCatalog',
                    name: 'Climate Controlled Storage',
                    itemListElement: [
                      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Climate Controlled Storage' } },
                    ],
                  },
                  {
                    '@type': 'OfferCatalog',
                    name: 'Drive-Up Storage',
                    itemListElement: [
                      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Drive-Up Storage' } },
                    ],
                  },
                  {
                    '@type': 'OfferCatalog',
                    name: 'Vehicle, Boat, RV & Trailer Storage',
                    itemListElement: [
                      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Vehicle, Boat, RV & Trailer Storage' } },
                    ],
                  },
                ],
              },
              // aggregateRating: values should match Google Business Profile rating
              // Update these when real Google reviews are fetched via /api/public/reviews
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '5.0',
                reviewCount: '1',
                bestRating: '5',
                worstRating: '1',
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
