import { describe, it, expect } from 'vitest'
import {
  feeForUnitType,
  isReservationFeeEnabled,
  refundAmountForCancel,
  reservationDepositCredit,
  RESERVATION_DEPOSIT_COPY,
} from './reservationFee'

const fees = [
  { unitType: 'standard', amount: 2500 },
  { unitType: 'climate_controlled', amount: 5000 },
  { unitType: 'drive_up', amount: 0 }, // disabled
]

describe('feeForUnitType', () => {
  it('returns the configured amount when present', () => {
    expect(feeForUnitType('standard', fees)).toBe(2500)
  })
  it('returns 0 when amount is 0', () => {
    expect(feeForUnitType('drive_up', fees)).toBe(0)
  })
  it('returns 0 when type is not in the list', () => {
    expect(feeForUnitType('vehicle_outdoor', fees)).toBe(0)
  })
  it('returns 0 on null inputs', () => {
    expect(feeForUnitType(null, fees)).toBe(0)
    expect(feeForUnitType('standard', null)).toBe(0)
  })
})

describe('isReservationFeeEnabled', () => {
  it('true when fee > 0', () => {
    expect(isReservationFeeEnabled('standard', fees)).toBe(true)
  })
  it('false when fee is 0', () => {
    expect(isReservationFeeEnabled('drive_up', fees)).toBe(false)
  })
  it('false when type missing', () => {
    expect(isReservationFeeEnabled('vehicle_outdoor', fees)).toBe(false)
  })
})

describe('refundAmountForCancel', () => {
  it('refunds full amount when not yet converted', () => {
    expect(refundAmountForCancel({ paidAmount: 2500, convertedToLease: false })).toBe(2500)
  })
  it('refunds nothing once converted to a lease', () => {
    expect(refundAmountForCancel({ paidAmount: 2500, convertedToLease: true })).toBe(0)
  })
  it('clamps negative paid amounts to zero', () => {
    expect(refundAmountForCancel({ paidAmount: -1, convertedToLease: false })).toBe(0)
  })
})

describe('reservationDepositCredit', () => {
  it('returns the amount paid', () => {
    expect(reservationDepositCredit(2500)).toBe(2500)
  })
  it('clamps to zero when fed a negative', () => {
    expect(reservationDepositCredit(-50)).toBe(0)
  })
})

describe('spec copy', () => {
  it('contains the deposit-credit promise verbatim', () => {
    expect(RESERVATION_DEPOSIT_COPY).toContain('credited back on the first rental invoice')
  })
})
