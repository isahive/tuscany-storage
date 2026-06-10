/**
 * Admin endpoint to list PDK devices for the configured system. Used by the
 * facility settings page to populate the entry/exit device picker.
 *
 * Returns a slim shape ({id, name, type}) — the full PDK Device record is
 * large and most fields aren't useful for the picker.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pdkFetch } from '@/lib/pdkAuth'
import { pdkConfigured } from '@/lib/pdkSync'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface PdkDeviceRaw {
  id: string
  name: string
  type?: string
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!pdkConfigured()) {
    return NextResponse.json({ success: true, data: [] })
  }

  try {
    const res = await pdkFetch('/devices')
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json(
        { success: false, error: `PDK ${res.status}: ${body}` },
        { status: 502 },
      )
    }
    const raw = (await res.json()) as PdkDeviceRaw[]
    const slim = raw.map((d) => ({ id: d.id, name: d.name, type: d.type ?? null }))
    return NextResponse.json({ success: true, data: slim })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
