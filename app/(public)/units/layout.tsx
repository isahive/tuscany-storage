import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Storage Units',
  description:
    'Browse available storage units at Tuscany Village Self Storage. Climate-controlled, drive-up, standard, and vehicle storage options in Caryville, TN.',
}

export default function UnitsLayout({ children }: { children: React.ReactNode }) {
  return children
}
