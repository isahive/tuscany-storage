'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import PortalNavbar from '@/components/portal/PortalNavbar'
import Footer from '@/components/public/Footer'

function PortalShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const tenantName = session?.user?.name ?? 'Tenant'

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PortalNavbar tenantName={tenantName} />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-12">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PortalShell>{children}</PortalShell>
    </SessionProvider>
  )
}
