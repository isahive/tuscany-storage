import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import { renderTemplate } from '@/lib/sendNotification'
import NotificationTemplate from '@/models/NotificationTemplate'

// renderTemplate is the rendering primitive the receipt preview page calls.
// These tests verify that:
//  1) DB templates take priority over defaults
//  2) Placeholders are substituted
//  3) Missing templates return null (no throw)
describe('renderTemplate', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns null when the template name is unknown', async () => {
    const tenant = await makeTenant()
    const result = await renderTemplate({
      templateName: 'Nonexistent Template',
      tenant,
    })
    expect(result).toBeNull()
  })

  it('falls back to DEFAULT_TEMPLATES when no DB row exists', async () => {
    const tenant = await makeTenant({ firstName: 'Ada', lastName: 'Lovelace' })
    const result = await renderTemplate({
      templateName: 'Move Out Receipt',
      tenant,
      unitNumber: 'G5',
      balance: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.subject).toContain('Move-Out')
    expect(result!.emailHtml).toContain('Ada Lovelace')
    expect(result!.emailHtml).toContain('G5')
    // wrapTenantEmail injects the logo banner table
    expect(result!.emailHtmlWrapped).toContain('<table')
  })

  it('prefers a customized DB template over the default', async () => {
    await NotificationTemplate.create({
      name: 'Move Out Receipt',
      type: 'default',
      emailSubject: 'Custom Subject for [[CUSTOMER_NAME]]',
      emailContent: '<p>Custom body for unit [[UNIT_NUMBER]]</p>',
      textContent: 'Custom SMS [[UNIT_NUMBER]]',
      emailEnabled: true,
      textEnabled: true,
      active: true,
    })
    const tenant = await makeTenant({ firstName: 'Grace', lastName: 'Hopper' })
    const result = await renderTemplate({
      templateName: 'Move Out Receipt',
      tenant,
      unitNumber: 'B12',
    })
    expect(result!.subject).toBe('Custom Subject for Grace Hopper')
    expect(result!.emailHtml).toBe('<p>Custom body for unit B12</p>')
    expect(result!.smsBody).toBe('Custom SMS B12')
  })

  it('reflects emailEnabled / textEnabled flags from the DB row', async () => {
    await NotificationTemplate.create({
      name: 'Move Out Receipt',
      type: 'default',
      emailSubject: 'x',
      emailContent: 'x',
      textContent: 'x',
      emailEnabled: false,
      textEnabled: true,
      active: true,
    })
    const tenant = await makeTenant()
    const result = await renderTemplate({ templateName: 'Move Out Receipt', tenant })
    expect(result!.emailEnabled).toBe(false)
    expect(result!.textEnabled).toBe(true)
  })
})
