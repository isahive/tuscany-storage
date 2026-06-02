/**
 * Convert a waiting-list entry into a real Tenant.
 *
 * Creates the tenant from the waiting-list snapshot (name split into first/
 * last by whitespace, email/phone/smsOptIn carried over) with a random
 * temporary password the admin will reset (or the tenant will reset via the
 * forgot-password flow). Marks the entry as 'converted' and returns the new
 * tenantId so the frontend can navigate to the tenant detail page to finish
 * the rent-unit flow.
 *
 * Idempotency: if the entry is already 'converted' we 409 — re-running is a
 * sign of double-click or admin mistake, both of which should be visible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import WaitingList from '@/models/WaitingList'
import Tenant from '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string }>
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export async function POST(_req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  await connectDB()
  const entry = await WaitingList.findById(id)
  if (!entry) {
    return NextResponse.json({ success: false, error: 'Waiting list entry not found' }, { status: 404 })
  }
  if (entry.status === 'converted') {
    return NextResponse.json(
      { success: false, error: 'Entry already converted' },
      { status: 409 },
    )
  }

  // Reuse an existing tenant with the same email if one already exists —
  // happens when a customer signs up on the public site after being on the
  // waiting list. Linking instead of duplicating keeps balance + history
  // attributed correctly.
  const existing = await Tenant.findOne({ email: entry.email.toLowerCase() })
  let tenantId: unknown
  if (existing) {
    tenantId = existing._id
  } else {
    const { firstName, lastName } = splitName(entry.name)
    const tempPassword = crypto.randomBytes(16).toString('hex')
    const hashed = await bcrypt.hash(tempPassword, 10)
    const created = await Tenant.create({
      firstName,
      lastName: lastName || '-',
      email: entry.email.toLowerCase(),
      phone: entry.phone,
      password: hashed,
      smsOptIn: !!entry.smsOptIn,
      status: 'active',
      role: 'tenant',
      autopayEnabled: false,
    })
    tenantId = created._id
  }

  entry.status = 'converted'
  await entry.save()

  return NextResponse.json({
    success: true,
    data: {
      tenantId,
      reused: !!existing,
      entry,
    },
  })
}
