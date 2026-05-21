import { describe, it, expect } from 'vitest'
import { syncTenantStatusFromBalance } from './tenantStatus'

describe('syncTenantStatusFromBalance', () => {
  it('flips active → delinquent when balance becomes positive', () => {
    const t = { status: 'active', balance: 500 }
    syncTenantStatusFromBalance(t)
    expect(t.status).toBe('delinquent')
  })

  it('flips delinquent → active when balance hits zero or below', () => {
    const a = { status: 'delinquent', balance: 0 }
    const b = { status: 'delinquent', balance: -100 }
    syncTenantStatusFromBalance(a); expect(a.status).toBe('active')
    syncTenantStatusFromBalance(b); expect(b.status).toBe('active')
  })

  it('leaves active alone when balance is zero or negative', () => {
    const t = { status: 'active', balance: 0 }
    syncTenantStatusFromBalance(t)
    expect(t.status).toBe('active')
  })

  it('does not touch locked_out or moved_out (terminal states)', () => {
    const a = { status: 'locked_out', balance: -500 }
    const b = { status: 'moved_out', balance: 1000 }
    syncTenantStatusFromBalance(a); expect(a.status).toBe('locked_out')
    syncTenantStatusFromBalance(b); expect(b.status).toBe('moved_out')
  })

  it('treats missing balance as zero', () => {
    const t = { status: 'delinquent' }
    syncTenantStatusFromBalance(t)
    expect(t.status).toBe('active')
  })
})
