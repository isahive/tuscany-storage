import { describe, it, expect } from 'vitest'
import {
  lockoutFeeKey,
  shouldAutoApprove,
  lateLienEventKey,
  lateLienFeeKey,
} from './lockout'

describe('lockoutFeeKey', () => {
  it('embeds lockedOutAt so each lockout episode gets a unique key', () => {
    const a = lockoutFeeKey({ leaseId: 'l1', eventId: 'e1', feeName: 'Lockout Fee', lockedOutAt: new Date('2026-03-01T00:00:00Z') })
    const b = lockoutFeeKey({ leaseId: 'l1', eventId: 'e1', feeName: 'Lockout Fee', lockedOutAt: new Date('2026-07-01T00:00:00Z') })
    expect(a).not.toBe(b)
  })
  it('two cron runs against the same lockout produce the same key (idempotent)', () => {
    const t = new Date('2026-03-01T00:00:00Z')
    const a = lockoutFeeKey({ leaseId: 'l1', eventId: 'e1', feeName: 'Lockout Fee', lockedOutAt: t })
    const b = lockoutFeeKey({ leaseId: 'l1', eventId: 'e1', feeName: 'Lockout Fee', lockedOutAt: t })
    expect(a).toBe(b)
  })
  it('different leases produce different keys', () => {
    const t = new Date('2026-03-01T00:00:00Z')
    const a = lockoutFeeKey({ leaseId: 'l1', eventId: 'e1', feeName: 'Lockout Fee', lockedOutAt: t })
    const b = lockoutFeeKey({ leaseId: 'l2', eventId: 'e1', feeName: 'Lockout Fee', lockedOutAt: t })
    expect(a).not.toBe(b)
  })
})

describe('lateLienEventKey', () => {
  const period = new Date(2026, 2, 1) // March
  const lockedOutAt = new Date('2026-03-05T00:00:00Z')

  it('Late uses per-billing-period key (yyyy-mm)', () => {
    const k = lateLienEventKey({ leaseId: 'l1', eventId: 'e_late', status: 'late', periodStart: period })
    expect(k).toContain('2026-03')
    expect(k).not.toContain('episode:')
  })

  it('Late key differs across months — re-sends monthly', () => {
    const a = lateLienEventKey({ leaseId: 'l1', eventId: 'e_late', status: 'late', periodStart: new Date(2026, 2, 1) })
    const b = lateLienEventKey({ leaseId: 'l1', eventId: 'e_late', status: 'late', periodStart: new Date(2026, 3, 1) })
    expect(a).not.toBe(b)
  })

  it('Locked Out uses per-episode key (lockedOutAt)', () => {
    const k = lateLienEventKey({ leaseId: 'l1', eventId: 'e_lo', status: 'locked_out', periodStart: period, lockedOutAt })
    expect(k).toContain('episode:')
    expect(k).toContain(lockedOutAt.toISOString())
  })

  it('Pre-Lien / Lien / Auction also use per-episode key — never repeat monthly', () => {
    const monthA = new Date(2026, 2, 1)
    const monthB = new Date(2026, 3, 1)
    for (const status of ['pre_lien', 'lien', 'auction'] as const) {
      const k1 = lateLienEventKey({ leaseId: 'l1', eventId: 'e', status, periodStart: monthA, lockedOutAt })
      const k2 = lateLienEventKey({ leaseId: 'l1', eventId: 'e', status, periodStart: monthB, lockedOutAt })
      expect(k1).toBe(k2)
    }
  })

  it('non-Late events get different keys across distinct lockout episodes', () => {
    const ep1 = new Date('2026-03-05T00:00:00Z')
    const ep2 = new Date('2026-08-12T00:00:00Z')
    const a = lateLienEventKey({ leaseId: 'l1', eventId: 'e', status: 'locked_out', periodStart: period, lockedOutAt: ep1 })
    const b = lateLienEventKey({ leaseId: 'l1', eventId: 'e', status: 'locked_out', periodStart: period, lockedOutAt: ep2 })
    expect(a).not.toBe(b)
  })
})

describe('lateLienFeeKey', () => {
  const period = new Date(2026, 2, 1)
  const lockedOutAt = new Date('2026-03-05T00:00:00Z')

  it('Late fee key recurs monthly', () => {
    const a = lateLienFeeKey({ leaseId: 'l1', eventId: 'e_late', feeName: 'Past Due', status: 'late', periodStart: new Date(2026, 2, 1) })
    const b = lateLienFeeKey({ leaseId: 'l1', eventId: 'e_late', feeName: 'Past Due', status: 'late', periodStart: new Date(2026, 3, 1) })
    expect(a).not.toBe(b)
  })

  it('Non-Late fee key is per-episode', () => {
    const k = lateLienFeeKey({ leaseId: 'l1', eventId: 'e_lo', feeName: 'Cut Lock', status: 'locked_out', periodStart: period, lockedOutAt })
    expect(k).toContain('episode:')
  })
})

describe('shouldAutoApprove', () => {
  const noFlags = {}
  const autoOn = { lockoutRequireApprovalAuto: true }
  const manualOn = { lockoutRequireApprovalManual: true }
  const both = { lockoutRequireApprovalAuto: true, lockoutRequireApprovalManual: true }

  it('lockouts always auto-approve regardless of flags', () => {
    expect(shouldAutoApprove({ type: 'locked_out', trigger: 'auto', settings: both })).toBe(true)
    expect(shouldAutoApprove({ type: 'locked_out', trigger: 'manual', settings: both })).toBe(true)
  })

  it('auto unlocks: gated by lockoutRequireApprovalAuto', () => {
    expect(shouldAutoApprove({ type: 'unlocked', trigger: 'auto', settings: noFlags })).toBe(true)
    expect(shouldAutoApprove({ type: 'unlocked', trigger: 'auto', settings: autoOn })).toBe(false)
    expect(shouldAutoApprove({ type: 'unlocked', trigger: 'auto', settings: manualOn })).toBe(true)
  })

  it('manual unlocks: gated by lockoutRequireApprovalManual', () => {
    expect(shouldAutoApprove({ type: 'unlocked', trigger: 'manual', settings: noFlags })).toBe(true)
    expect(shouldAutoApprove({ type: 'unlocked', trigger: 'manual', settings: manualOn })).toBe(false)
    expect(shouldAutoApprove({ type: 'unlocked', trigger: 'manual', settings: autoOn })).toBe(true)
  })
})
