import type { Metadata } from 'next'

// Checkout flow — give it a real title but keep it out of search results
// (each /reserve/[unitId] URL is a thin transactional page).
export const metadata: Metadata = {
  title: 'Reserve Your Storage Unit',
  description:
    'Reserve your storage unit online at Tuscany Village Self Storage in Caryville, TN. Quick, secure checkout with instant confirmation.',
  robots: { index: false, follow: true },
}

export default function ReserveLayout({ children }: { children: React.ReactNode }) {
  return children
}
