import { describe, it, expect } from 'vitest'
import {
  TENANT_GROUPS,
  isValidTenantGroup,
  tenantGroupLabel,
  tenantGroupDescription,
} from './tenantGroups'

describe('TENANT_GROUPS', () => {
  it('lists all 18 groups (17 segments + All)', () => {
    expect(TENANT_GROUPS).toHaveLength(18)
  })
  it('includes the Archived group', () => {
    expect(TENANT_GROUPS.some((g) => g.id === 'archived')).toBe(true)
  })
  it('has unique ids', () => {
    const ids = TENANT_GROUPS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('every group has a non-empty label and description (except All)', () => {
    for (const g of TENANT_GROUPS) {
      expect(g.label.length).toBeGreaterThan(0)
      if (g.id !== 'all') expect(g.description.length).toBeGreaterThan(0)
    }
  })
})

describe('isValidTenantGroup', () => {
  it('accepts known ids', () => {
    expect(isValidTenantGroup('locked_out')).toBe(true)
    expect(isValidTenantGroup('past_due')).toBe(true)
  })
  it('rejects unknown ids', () => {
    expect(isValidTenantGroup('unknown')).toBe(false)
    expect(isValidTenantGroup('')).toBe(false)
  })
})

describe('tenantGroupLabel / Description', () => {
  it('returns label for a known group', () => {
    expect(tenantGroupLabel('locked_out')).toBe('Locked Out')
  })
  it('returns description for a known group', () => {
    expect(tenantGroupDescription('automatic_lockout_disabled')).toContain('skip automated lockouts')
  })
})
