import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  normalizePhone,
  normalizeEmail,
  nameKey,
  addressKey,
  pairKey,
  findDuplicates,
  type TenantForMatch,
} from './tenantDuplicates'

const base = (over: Partial<TenantForMatch>): TenantForMatch => ({
  id: 'x',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  zip: '',
  ...over,
})

describe('normalizeText', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeText('José M. Núñez!')).toBe('jose m nunez')
  })
  it('collapses whitespace', () => {
    expect(normalizeText('  John   Doe ')).toBe('john doe')
  })
  it('returns empty string for nullish input', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
  })
})

describe('normalizePhone', () => {
  it('keeps only digits', () => {
    expect(normalizePhone('(865) 426-2100')).toBe('8654262100')
  })
  it('drops leading US country code', () => {
    expect(normalizePhone('+1 865 426 2100')).toBe('8654262100')
  })
  it('returns empty for nullish input', () => {
    expect(normalizePhone(null)).toBe('')
  })
})

describe('normalizeEmail', () => {
  it('strips "+suffix" aliases', () => {
    expect(normalizeEmail('john+spam@gmail.com')).toBe('john@gmail.com')
  })
  it('lowercases', () => {
    expect(normalizeEmail('John.Doe@Gmail.COM')).toBe('john.doe@gmail.com')
  })
  it('returns empty for malformed inputs', () => {
    expect(normalizeEmail('not-an-email')).toBe('')
    expect(normalizeEmail('')).toBe('')
  })
})

describe('nameKey', () => {
  it('combines normalized first + last', () => {
    expect(nameKey(base({ firstName: 'John', lastName: 'Doe' }))).toBe('john doe')
  })
  it('returns empty when either part is missing', () => {
    expect(nameKey(base({ firstName: 'John' }))).toBe('')
    expect(nameKey(base({ lastName: 'Doe' }))).toBe('')
  })
})

describe('addressKey', () => {
  it('combines normalized line1 with zip', () => {
    expect(addressKey(base({ address: '123 Main St.', zip: '37902' }))).toBe('123 main st|37902')
  })
  it('falls back to billingAddress when primary address is missing', () => {
    expect(
      addressKey(
        base({ billingAddress: { line1: '456 Oak Ave', zip: '37902' } }),
      ),
    ).toBe('456 oak ave|37902')
  })
  it('returns empty when zip missing', () => {
    expect(addressKey(base({ address: '123 Main St' }))).toBe('')
  })
})

describe('pairKey', () => {
  it('is symmetric', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'))
  })
})

describe('findDuplicates', () => {
  it('flags card fingerprint match as high confidence', () => {
    const result = findDuplicates([
      base({ id: '1', cardFingerprint: 'fp_aaa', firstName: 'A', lastName: 'A' }),
      base({ id: '2', cardFingerprint: 'fp_aaa', firstName: 'B', lastName: 'B' }),
    ])
    const forOne = result.find((m) => m.tenantId === '1')
    expect(forOne).toBeDefined()
    expect(forOne!.otherId).toBe('2')
    expect(forOne!.reasons).toEqual(['card'])
    expect(forOne!.confidence).toBe('high')
  })

  it('returns both ordered pairs (1→2 and 2→1)', () => {
    const result = findDuplicates([
      base({ id: '1', firstName: 'Jess', lastName: 'Smith' }),
      base({ id: '2', firstName: 'jess', lastName: 'SMITH' }),
    ])
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.tenantId).sort()).toEqual(['1', '2'])
  })

  it('combines name + address into high confidence', () => {
    const result = findDuplicates([
      base({
        id: '1',
        firstName: 'Jane',
        lastName: 'Doe',
        address: '12 Pine St',
        zip: '37902',
      }),
      base({
        id: '2',
        firstName: 'Jane',
        lastName: 'Doe',
        address: '12 Pine St',
        zip: '37902',
      }),
    ])
    const m = result.find((r) => r.tenantId === '1')!
    expect(m.reasons.sort()).toEqual(['address', 'name'])
    expect(m.confidence).toBe('high')
  })

  it('name-only match is medium confidence', () => {
    const result = findDuplicates([
      base({ id: '1', firstName: 'Jane', lastName: 'Doe' }),
      base({ id: '2', firstName: 'Jane', lastName: 'Doe' }),
    ])
    expect(result[0].confidence).toBe('medium')
  })

  it('phone-only match is low confidence', () => {
    const result = findDuplicates([
      base({ id: '1', phone: '865-426-2100' }),
      base({ id: '2', phone: '(865) 426 2100' }),
    ])
    expect(result[0].reasons).toEqual(['phone'])
    expect(result[0].confidence).toBe('low')
  })

  it('skips pairs already linked', () => {
    const result = findDuplicates([
      base({ id: '1', firstName: 'A', lastName: 'X', linkedTenantIds: ['2'] }),
      base({ id: '2', firstName: 'A', lastName: 'X', linkedTenantIds: ['1'] }),
    ])
    expect(result).toHaveLength(0)
  })

  it('skips pairs dismissed by the operator', () => {
    const result = findDuplicates([
      base({ id: '1', firstName: 'A', lastName: 'X', dismissedMatchIds: ['2'] }),
      base({ id: '2', firstName: 'A', lastName: 'X' }),
    ])
    expect(result).toHaveLength(0)
  })

  it('excludes archived tenants', () => {
    const result = findDuplicates([
      base({ id: '1', firstName: 'A', lastName: 'X', archived: true }),
      base({ id: '2', firstName: 'A', lastName: 'X' }),
    ])
    expect(result).toHaveLength(0)
  })

  it('excludes the retail walk-in synthetic tenant', () => {
    const result = findDuplicates([
      base({ id: '1', firstName: 'Walk', lastName: 'In', isRetailWalkIn: true }),
      base({ id: '2', firstName: 'Walk', lastName: 'In' }),
    ])
    expect(result).toHaveLength(0)
  })

  it('ignores tenants with missing keys (does not false-positive on empty strings)', () => {
    const result = findDuplicates([
      base({ id: '1' }),
      base({ id: '2' }),
    ])
    expect(result).toHaveLength(0)
  })

  it('orders results by confidence', () => {
    const result = findDuplicates([
      base({ id: '1', phone: '8001112222' }),
      base({ id: '2', phone: '8001112222' }), // low confidence pair
      base({ id: '3', cardFingerprint: 'fp_xyz' }),
      base({ id: '4', cardFingerprint: 'fp_xyz' }), // high confidence pair
    ])
    expect(result[0].confidence).toBe('high')
    expect(result[result.length - 1].confidence).toBe('low')
  })
})
