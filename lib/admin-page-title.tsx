'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Ctx = {
  title: string | null
  setTitle: (t: string | null) => void
}

const AdminPageTitleContext = createContext<Ctx | null>(null)

export function AdminPageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  return (
    <AdminPageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </AdminPageTitleContext.Provider>
  )
}

/** Read the page title set by a child page (used by layout breadcrumb). */
export function useAdminPageTitle(): string | null {
  const ctx = useContext(AdminPageTitleContext)
  return ctx?.title ?? null
}

/** Pages call this to publish their dynamic title (e.g. the tenant's name). */
export function useSetAdminPageTitle(title: string | null) {
  const ctx = useContext(AdminPageTitleContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setTitle(title)
    return () => ctx.setTitle(null)
  }, [ctx, title])
}
