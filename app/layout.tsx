import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tuscany Village Self Storage',
  description: 'Secure, affordable self storage in your community',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
