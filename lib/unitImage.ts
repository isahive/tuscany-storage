/**
 * Map a unit to its real image path (sourced from the live tuscanystorage.com).
 * Prefers matching by size (e.g. "10x10"); falls back to type-based mapping.
 */
const SIZE_IMAGES = ['5x10', '10x10', '10x15', '10x20', '10x30'] as const

export function unitImage(unit: { size?: string; type?: string }): string {
  const sizeKey = (unit.size ?? '').toLowerCase().replace(/\s/g, '')
  if ((SIZE_IMAGES as readonly string[]).includes(sizeKey)) {
    return `/images/units/${sizeKey}.png`
  }
  // Vehicle/outdoor storage uses the fifth-wheel icon from the live
  if (unit.type === 'vehicle_outdoor') return '/images/units/fifth.png'
  // Sensible fallback by type
  if (unit.type === 'drive_up') return '/images/units/10x20.png'
  return '/images/units/10x10.png'
}
