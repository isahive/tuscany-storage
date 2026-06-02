import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import WaitingList from '@/models/WaitingList'

const UNIT_ID = () => new Types.ObjectId().toString()

const dispatchMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendSMS: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendEmail: dispatchMocks.sendEmail }))
vi.mock('@/lib/twilio', () => ({ sendSMS: dispatchMocks.sendSMS, default: () => null }))

import { notifyFirstMatchingWaitingListEntry } from './waitingListMatch'

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  dispatchMocks.sendEmail.mockReset()
  dispatchMocks.sendSMS.mockReset()
})

async function seedEntry(over: Record<string, unknown> = {}) {
  return WaitingList.create({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '555-0001',
    preferredSize: '10x10',
    status: 'waiting',
    ...over,
  })
}

describe('notifyFirstMatchingWaitingListEntry', () => {
  it('returns matched=false when the unit has no size', async () => {
    const res = await notifyFirstMatchingWaitingListEntry({ _id: UNIT_ID() })
    expect(res.matched).toBe(false)
    expect(dispatchMocks.sendEmail).not.toHaveBeenCalled()
  })

  it('returns matched=false when no waiting entry matches', async () => {
    await seedEntry({ preferredSize: '5x5' })
    const res = await notifyFirstMatchingWaitingListEntry({ _id: UNIT_ID(), size: '10x10' })
    expect(res.matched).toBe(false)
  })

  it('matches the longest-waiting entry first', async () => {
    const older = await seedEntry({ name: 'Older', email: 'old@x.com', createdAt: new Date('2024-01-01') })
    await new Promise((r) => setTimeout(r, 5)) // ensure distinct createdAt
    await seedEntry({ name: 'Newer', email: 'new@x.com' })

    dispatchMocks.sendEmail.mockResolvedValueOnce('id')

    const res = await notifyFirstMatchingWaitingListEntry({
      _id: UNIT_ID(), unitNumber: 'A1', size: '10x10',
    })
    expect(res.matched).toBe(true)
    expect(res.entryId).toBe(String(older._id))
  })

  it('honors preferredType when set', async () => {
    await seedEntry({ name: 'Climate', preferredType: 'climate' })
    await seedEntry({ name: 'Standard', preferredType: 'standard' })

    dispatchMocks.sendEmail.mockResolvedValue('id')

    const res = await notifyFirstMatchingWaitingListEntry({
      _id: UNIT_ID(), size: '10x10', type: 'standard',
    })
    expect(res.matched).toBe(true)
    const matched = await WaitingList.findById(res.entryId)
    expect(matched!.preferredType).toBe('standard')
  })

  it('treats no preferredType as a wildcard match', async () => {
    await seedEntry({ name: 'Any' }) // no preferredType
    dispatchMocks.sendEmail.mockResolvedValueOnce('id')

    const res = await notifyFirstMatchingWaitingListEntry({
      _id: UNIT_ID(), size: '10x10', type: 'climate',
    })
    expect(res.matched).toBe(true)
  })

  it('dispatches email always, SMS only when smsOptIn is true', async () => {
    await seedEntry({ smsOptIn: false })
    dispatchMocks.sendEmail.mockResolvedValueOnce('id')

    const res = await notifyFirstMatchingWaitingListEntry({ _id: UNIT_ID(), size: '10x10' })
    expect(res.emailDispatched).toBe(true)
    expect(res.smsDispatched).toBeFalsy()
    expect(dispatchMocks.sendSMS).not.toHaveBeenCalled()
  })

  it('dispatches SMS when smsOptIn is true', async () => {
    await seedEntry({ smsOptIn: true })
    dispatchMocks.sendEmail.mockResolvedValueOnce('id')
    dispatchMocks.sendSMS.mockResolvedValueOnce('sid')

    const res = await notifyFirstMatchingWaitingListEntry({ _id: UNIT_ID(), size: '10x10' })
    expect(res.emailDispatched).toBe(true)
    expect(res.smsDispatched).toBe(true)
  })

  it('flips entry status to notified + stamps notifiedAt + notifiedUnitId', async () => {
    const entry = await seedEntry()
    dispatchMocks.sendEmail.mockResolvedValueOnce('id')

    const unitId = UNIT_ID()
    await notifyFirstMatchingWaitingListEntry({ _id: unitId, size: '10x10' })

    const after = await WaitingList.findById(entry._id)
    expect(after!.status).toBe('notified')
    expect(after!.notifiedAt).toBeInstanceOf(Date)
    expect(String(after!.notifiedUnitId)).toBe(unitId)
  })

  it('does NOT consider entries with status != waiting', async () => {
    await seedEntry({ status: 'notified' })
    await seedEntry({ status: 'converted', email: 'c@x.com' })
    await seedEntry({ status: 'expired', email: 'e@x.com' })

    const res = await notifyFirstMatchingWaitingListEntry({ _id: UNIT_ID(), size: '10x10' })
    expect(res.matched).toBe(false)
  })

  it('does not throw if email + sms both fail — flips status anyway', async () => {
    const entry = await seedEntry({ smsOptIn: true })
    dispatchMocks.sendEmail.mockRejectedValueOnce(new Error('Resend down'))
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('Twilio down'))

    const res = await notifyFirstMatchingWaitingListEntry({ _id: UNIT_ID(), size: '10x10' })
    expect(res.matched).toBe(true)
    expect(res.emailDispatched).toBe(false)
    expect(res.smsDispatched).toBe(false)

    const after = await WaitingList.findById(entry._id)
    expect(after!.status).toBe('notified')
  })
})
