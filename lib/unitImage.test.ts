import { describe, it, expect } from 'vitest'
import { unitImage } from './unitImage'

describe('unitImage', () => {
  it.each([
    ['5x10',  '/images/units/5x10.png'],
    ['10x10', '/images/units/10x10.png'],
    ['10x15', '/images/units/10x15.png'],
    ['10x20', '/images/units/10x20.png'],
    ['10x30', '/images/units/10x30.png'],
  ])('maps size %s to %s', (size, expected) => {
    expect(unitImage({ size })).toBe(expected)
  })

  it('normalizes case and whitespace in size', () => {
    expect(unitImage({ size: '10X10' })).toBe('/images/units/10x10.png')
    expect(unitImage({ size: ' 10 x 10 ' })).toBe('/images/units/10x10.png')
  })

  it('uses fifth-wheel icon for vehicle_outdoor type', () => {
    expect(unitImage({ type: 'vehicle_outdoor' })).toBe('/images/units/fifth.png')
  })

  it('uses the 10x20 image for drive_up type without a known size', () => {
    expect(unitImage({ type: 'drive_up' })).toBe('/images/units/10x20.png')
  })

  it('size match wins over type match', () => {
    expect(unitImage({ size: '5x10', type: 'vehicle_outdoor' })).toBe('/images/units/5x10.png')
  })

  it('falls back to 10x10 when nothing matches', () => {
    expect(unitImage({})).toBe('/images/units/10x10.png')
    expect(unitImage({ size: 'weird-size' })).toBe('/images/units/10x10.png')
  })
})
