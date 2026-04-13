import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Storage Unit Details | Tuscany Village Self Storage',
  description:
    'View storage unit details, features, pricing, and availability at Tuscany Village Self Storage in Caryville, TN. Reserve online today.',
}

export default function UnitDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
