import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Waiting List',
  description:
    'Join the waiting list for a storage unit at Tuscany Village Self Storage in Caryville, TN. Get notified when your preferred unit size becomes available.',
}

export default function WaitingListLayout({ children }: { children: React.ReactNode }) {
  return children
}
