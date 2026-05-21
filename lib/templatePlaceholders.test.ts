import { describe, it, expect } from 'vitest'
import { replacePlaceholders, AVAILABLE_PLACEHOLDERS } from './templatePlaceholders'

describe('replacePlaceholders', () => {
  it('substitutes [[KEY]] tokens with values from the data map', () => {
    const out = replacePlaceholders(
      'Hello [[CUSTOMER_NAME]], your unit is [[UNIT_NUMBER]].',
      { CUSTOMER_NAME: 'Ada', UNIT_NUMBER: 'G5' },
    )
    expect(out).toBe('Hello Ada, your unit is G5.')
  })

  it('leaves text with no tokens alone', () => {
    expect(replacePlaceholders('No tokens here.', {})).toBe('No tokens here.')
  })

  it('replaces unknown tokens with empty string (silent miss)', () => {
    expect(replacePlaceholders('A [[X]] B', {})).toBe('A  B')
  })

  it('handles repeated tokens', () => {
    expect(
      replacePlaceholders('[[X]]-[[X]]-[[X]]', { X: 'a' }),
    ).toBe('a-a-a')
  })

  it('matches only [[WORD]] not [[a-b]] or [[a.b]]', () => {
    expect(
      replacePlaceholders('[[a-b]] and [[a.b]] stay', {}),
    ).toBe('[[a-b]] and [[a.b]] stay')
  })

  it('supports camelCase tokens (legacy alias keys)', () => {
    expect(
      replacePlaceholders('[[firstName]] [[lastName]]', {
        firstName: 'Grace', lastName: 'Hopper',
      }),
    ).toBe('Grace Hopper')
  })

  it('does not interpret HTML inside values', () => {
    // The function is pure string replacement — the email layer applies HTML
    // escaping if needed. Useful to lock that behavior in.
    expect(replacePlaceholders('[[X]]', { X: '<b>hi</b>' })).toBe('<b>hi</b>')
  })
})

describe('AVAILABLE_PLACEHOLDERS', () => {
  it('includes the canonical customer/unit/facility tokens', () => {
    for (const key of ['CUSTOMER_NAME', 'UNIT_NUMBER', 'BALANCE', 'FACILITY_NAME']) {
      expect(AVAILABLE_PLACEHOLDERS).toContain(key)
    }
  })

  it('includes legacy camelCase aliases for back-compat', () => {
    for (const key of ['tenantName', 'unitNumber', 'balance', 'facilityName']) {
      expect(AVAILABLE_PLACEHOLDERS).toContain(key)
    }
  })
})
