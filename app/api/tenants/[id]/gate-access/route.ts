import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import AccessLog from '@/models/AccessLog'
import Notification from '@/models/Notification'
import Settings from '@/models/Settings'
import { revokeGateAccess } from '@/lib/gateAccess'
import { computeAuctionDate } from '@/lib/auctionDate'

interface RouteContext {
  params: Promise<{ id: string }>
}

const gateAccessSchema = z.object({
  action: z.enum([
    'lock_out',
    'unlock',
    'set_access_code',
    'add_card',
    'remove_card',
    'save_groups',
    'set_automatic_lockout',
  ]),
  // lock_out
  auctionDate: z.string().optional(),
  note: z.string().optional(),
  // set_access_code
  accessCode: z.string().regex(/^\d{1,10}$/).optional(),
  // add_card / remove_card — must be unique, cannot start with 0
  card: z.string().regex(/^[1-9]\d*$/).optional(),
  // save_groups
  groups: z.array(z.string()).optional(),
  // set_automatic_lockout
  enabled: z.boolean().optional(),
  days: z.number().int().min(0).max(120).optional(),
})

// GET — return tenant gate access state + active lease summary
export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  await connectDB()

  const tenant = await Tenant.findById(id).lean() as any
  if (!tenant) {
    return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
  }

  const activeLease = await Lease.findOne({
    tenantId: id,
    status: { $in: ['active', 'pending_moveout'] },
  }).lean<{ auctionDate?: Date | null; auctionScheduledAt?: Date | null } | null>()

  // Prefer the manually-set lockoutAuctionDate if the admin pinned one on
  // the tenant; fall back to the system-computed lease.auctionDate stamped
  // by the delinquency cron at lockout time.
  const effectiveAuctionDate = tenant.lockoutAuctionDate ?? activeLease?.auctionDate ?? null

  return NextResponse.json({
    success: true,
    data: {
      tenantId: tenant._id,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      status: tenant.status,
      gateCode: tenant.gateCode ?? '',
      additionalCards: tenant.additionalCards ?? [],
      gateGroups: tenant.gateGroups ?? [],
      lockoutAuctionDate: effectiveAuctionDate,
      // Distinguish for the UI which source the date came from.
      auctionDateSource: tenant.lockoutAuctionDate
        ? 'manual'
        : (activeLease?.auctionDate ? 'system' : null),
      lockoutNote: tenant.lockoutNote ?? '',
      automaticLockoutEnabled: tenant.automaticLockoutEnabled ?? true,
      automaticLockoutDays: tenant.automaticLockoutDays ?? 9,
      hasActiveRental: !!activeLease,
    },
  })
}

// POST — mutate gate access state by action
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = gateAccessSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()
    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    switch (parsed.data.action) {
      case 'lock_out': {
        tenant.status = 'locked_out'
        const lockedOutAt = new Date()
        tenant.lockedOutAt = lockedOutAt
        if (parsed.data.auctionDate) {
          tenant.lockoutAuctionDate = new Date(parsed.data.auctionDate)
        } else {
          // Storable "Automatic Auction Dates" — when the admin doesn't pin
          // a date manually, derive one from the Locked Out rule.
          const settings = await Settings.findOne({}).lean<{
            auctionDaysAfterLockout?: number
            auctionFixedDate?: Date | null
          }>()
          const computed = settings ? computeAuctionDate(lockedOutAt, settings) : null
          if (computed) tenant.lockoutAuctionDate = computed
        }
        if (parsed.data.note !== undefined) tenant.lockoutNote = parsed.data.note
        await tenant.save()
        // Wipe gate access — Storable parity: manual lock-out yanks code/cards/groups.
        await revokeGateAccess(tenant._id, 'manual')
        await Notification.create({
          tenantId: tenant._id,
          type: 'lockout_notice',
          channel: 'email',
          body: `Your gate access has been locked out.${parsed.data.note ? ` Reason: ${parsed.data.note}` : ''}`,
          status: 'pending',
        })
        break
      }

      case 'unlock': {
        tenant.status = 'active'
        tenant.lockoutAuctionDate = undefined
        tenant.lockoutNote = undefined
        tenant.lockedOutAt = undefined
        await tenant.save()
        await AccessLog.create({
          tenantId: tenant._id,
          eventType: 'code_changed',
          gateId: 'entrance',
          source: 'admin',
          notes: 'Lock-out cleared by admin.',
        })
        break
      }

      case 'set_access_code': {
        if (!parsed.data.accessCode) {
          return NextResponse.json({ success: false, error: 'accessCode required' }, { status: 400 })
        }
        const previousCode = tenant.gateCode
        tenant.gateCode = parsed.data.accessCode
        await tenant.save()
        await AccessLog.create({
          tenantId: tenant._id,
          eventType: 'code_changed',
          gateId: 'entrance',
          source: 'admin',
          notes: previousCode ? 'Gate code updated by admin.' : 'Gate code assigned by admin.',
        })
        // Mirror /api/gate behavior: notify tenant by SMS when their code changes.
        await Notification.create({
          tenantId: tenant._id,
          type: 'gate_code_changed',
          channel: 'sms',
          body: `Your gate access code has been updated. New code: ${parsed.data.accessCode}.`,
          status: 'pending',
        })
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEV GATE] Code set for ${tenant.firstName} ${tenant.lastName}: ${parsed.data.accessCode}`)
        }
        break
      }

      case 'add_card': {
        if (!parsed.data.card) {
          return NextResponse.json({ success: false, error: 'card required' }, { status: 400 })
        }
        const existing = tenant.additionalCards ?? []
        if (existing.includes(parsed.data.card)) {
          return NextResponse.json({ success: false, error: 'Card number must be unique' }, { status: 409 })
        }
        tenant.additionalCards = [...existing, parsed.data.card]
        await tenant.save()
        break
      }

      case 'remove_card': {
        if (!parsed.data.card) {
          return NextResponse.json({ success: false, error: 'card required' }, { status: 400 })
        }
        tenant.additionalCards = (tenant.additionalCards ?? []).filter((c: string) => c !== parsed.data.card)
        await tenant.save()
        break
      }

      case 'save_groups': {
        tenant.gateGroups = parsed.data.groups ?? []
        await tenant.save()
        break
      }

      case 'set_automatic_lockout': {
        if (parsed.data.enabled !== undefined) tenant.automaticLockoutEnabled = parsed.data.enabled
        if (parsed.data.days !== undefined) tenant.automaticLockoutDays = parsed.data.days
        await tenant.save()
        break
      }
    }

    return NextResponse.json({ success: true, data: tenant })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
