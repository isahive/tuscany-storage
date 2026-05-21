import { describe, it, expect } from 'vitest'
import {
  computeDisplayStatus,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_COLORS,
} from './unitStatus'

const now = new Date('2026-05-21T12:00:00Z')

describe('computeDisplayStatus', () => {
  it('maintenance always wins (physical unavailability)', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'maintenance',
        lease: { status: 'active' },
        tenant: { status: 'active' },
        now,
      }),
    ).toBe('unavailable')
  })

  it('reserved marketplace vs direct', () => {
    expect(
      computeDisplayStatus({ unitStatus: 'reserved', reservationSource: 'marketplace', now }),
    ).toBe('reserved_marketplace')
    expect(
      computeDisplayStatus({ unitStatus: 'reserved', reservationSource: 'direct', now }),
    ).toBe('reserved')
  })

  it('available returns available', () => {
    expect(computeDisplayStatus({ unitStatus: 'available', now })).toBe('available')
  })

  it('auction takes priority over locked_out and pending_moveout', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active', auctionDate: new Date('2026-06-15') },
        tenant: { status: 'locked_out' },
        now,
      }),
    ).toBe('auction')
  })

  it('locked_out beats pending_moveout', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'pending_moveout' },
        tenant: { status: 'locked_out' },
        now,
      }),
    ).toBe('locked_out')
  })

  it('moving_out for pending_moveout lease', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'pending_moveout' },
        tenant: { status: 'active' },
        now,
      }),
    ).toBe('moving_out')
  })

  it('pending when only a request flag is set (no lease change yet)', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active' },
        tenant: { status: 'active' },
        hasPendingMoveOutRequest: true,
        now,
      }),
    ).toBe('pending')
  })

  it('lien at 60+ days past due', () => {
    const due = new Date('2026-03-01')
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active' },
        tenant: { status: 'delinquent' },
        oldestUnpaid: { dueDate: due },
        now,
      }),
    ).toBe('lien')
  })

  it('pre_lien at 30–59 days past due', () => {
    const due = new Date('2026-04-15')
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active' },
        tenant: { status: 'delinquent' },
        oldestUnpaid: { dueDate: due },
        now,
      }),
    ).toBe('pre_lien')
  })

  it('late at 1–29 days past due', () => {
    const due = new Date('2026-05-10')
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active' },
        tenant: { status: 'delinquent' },
        oldestUnpaid: { dueDate: due },
        now,
      }),
    ).toBe('late')
  })

  it('rented when occupied + nothing operationally wrong', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active' },
        tenant: { status: 'active' },
        now,
      }),
    ).toBe('rented')
  })

  it('falls back to rented when oldestUnpaid has no usable date', () => {
    expect(
      computeDisplayStatus({
        unitStatus: 'occupied',
        lease: { status: 'active' },
        tenant: { status: 'delinquent' },
        oldestUnpaid: {},
        now,
      }),
    ).toBe('rented')
  })
})

describe('DISPLAY_STATUS_LABELS / DISPLAY_STATUS_COLORS', () => {
  it('has a label + color for every status the resolver can return', () => {
    const statuses = [
      'auction', 'available', 'late', 'lien', 'locked_out',
      'reserved_marketplace', 'moving_out', 'pending', 'pre_lien',
      'rented', 'reserved', 'unavailable',
    ] as const
    for (const s of statuses) {
      expect(DISPLAY_STATUS_LABELS[s]).toBeTruthy()
      expect(DISPLAY_STATUS_COLORS[s]).toMatchObject({ bg: expect.any(String), text: expect.any(String) })
    }
  })
})
