import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unit Details',
  description:
    'View storage unit details, features, and pricing at Tuscany Village Self Storage in Florence, SC.',
}

export default function UnitDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
