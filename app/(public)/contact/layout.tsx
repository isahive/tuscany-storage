import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Tuscany Village Self Storage in Caryville, TN. Call, email, or visit us for storage unit inquiries and support.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
