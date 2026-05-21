import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'

// startTestDb already connects mongoose to the memory server — short-circuit
// the prod cache so getSettings' connectDB call is a no-op.
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import Settings from '@/models/Settings'
import { getSettings } from './getSettings'
import { DEFAULT_SETTINGS } from './defaultSettings'

describe('getSettings', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns defaults when no Settings doc exists', async () => {
    const out = await getSettings()
    expect(out.facilityName).toBe(DEFAULT_SETTINGS.facilityName)
    expect(out.locale).toBe(DEFAULT_SETTINGS.locale)
    expect(out.currency).toBe(DEFAULT_SETTINGS.currency)
  })

  it('merges DB values on top of defaults', async () => {
    await Settings.create({
      facilityName: 'Custom Storage',
      facilityPhone: '555-9999',
      emailLogoUrl: 'https://cdn.example.com/logo.png',
    })

    const out = await getSettings()
    expect(out.facilityName).toBe('Custom Storage')
    expect(out.facilityPhone).toBe('555-9999')
    expect(out.emailLogoUrl).toBe('https://cdn.example.com/logo.png')
    // unset fields still come from defaults
    expect(out.locale).toBe(DEFAULT_SETTINGS.locale)
  })

  it('reads the first doc when multiple exist', async () => {
    await Settings.create({ facilityName: 'A' })
    await Settings.create({ facilityName: 'B' })
    const out = await getSettings()
    expect(out.facilityName).toMatch(/^(A|B)$/)
  })
})
