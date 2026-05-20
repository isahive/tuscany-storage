import { describe, it, expect } from 'vitest'
import { lockoutFeeKey, shouldAutoApprove } from './lockout'

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
