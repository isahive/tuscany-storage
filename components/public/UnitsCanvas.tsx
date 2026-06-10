import Link from 'next/link'

type UnitCell = {
  id: string
  unitNumber: string
  width: number
  depth: number
  size: string
  type: string
  status: string
  gridX: number
  gridY: number
  gridFloor?: number
  gridRotation?: 0 | 90
}

type Props = {
  units: UnitCell[]
  /** Pixels per cell (1 cell = 5 ft). Default 28. */
  cellPx?: number
}

type StatusStyle = { bg: string; border: string; color: string; label: string }

const PUBLIC_STATUS_STYLES: Record<'available' | 'unavailable', StatusStyle> = {
  available:   { bg: '#D1FAE5', border: '#6EE7B7', color: '#065F46', label: 'Available' },
  unavailable: { bg: '#E5E7EB', border: '#9CA3AF', color: '#374151', label: 'Unavailable' },
}

function styleFor(status: string): StatusStyle {
  return status === 'available' ? PUBLIC_STATUS_STYLES.available : PUBLIC_STATUS_STYLES.unavailable
}

export default function UnitsCanvas({ units, cellPx = 28 }: Props) {
  if (!units.length) return null

  const cellsPerFoot = 1 / 5

  // Width/depth swapped when rotated 90°
  const effW = (u: UnitCell) =>
    u.gridRotation === 90
      ? Math.max(1, Math.round(u.depth * cellsPerFoot))
      : Math.max(1, Math.round(u.width * cellsPerFoot))
  const effD = (u: UnitCell) =>
    u.gridRotation === 90
      ? Math.max(1, Math.round(u.width * cellsPerFoot))
      : Math.max(1, Math.round(u.depth * cellsPerFoot))

  // Compute canvas extents in cells
  const maxX = Math.max(...units.map((u) => (u.gridX ?? 0) + effW(u)))
  const maxY = Math.max(...units.map((u) => (u.gridY ?? 0) + effD(u)))

  const widthPx = (maxX + 1) * cellPx
  const heightPx = (maxY + 1) * cellPx

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white p-4">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-gray-700">
        {Object.entries(PUBLIC_STATUS_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
            />
            {s.label}
          </div>
        ))}
        <span className="text-gray-500">· Click an available unit to rent it</span>
      </div>

      {/* Canvas — a labeled group, not role="img", because available cells
          are interactive links and must stay exposed to assistive tech. */}
      <div
        className="relative"
        style={{ width: widthPx, height: heightPx }}
        role="group"
        aria-label="Facility map — available units are clickable"
      >
        {units.map((u) => {
          const w = effW(u)
          const d = effD(u)
          const s = styleFor(u.status)
          const isAvailable = u.status === 'available'
          const cellStyle = {
            left: u.gridX * cellPx,
            top: u.gridY * cellPx,
            width: w * cellPx,
            height: d * cellPx,
            backgroundColor: s.bg,
            border: `1px solid ${s.border}`,
            color: s.color,
          }
          const baseClass =
            'absolute flex items-center justify-center overflow-hidden text-[10px] font-semibold leading-none transition-shadow hover:shadow-md'
          const label = <span className="px-1 text-center">{u.unitNumber}</span>

          // Available units link straight to the per-unit reserve/rent flow.
          if (isAvailable) {
            return (
              <Link
                key={u.id}
                href={`/reserve/${u.id}`}
                title={`Unit ${u.unitNumber} — ${u.size} — Available · Click to rent`}
                aria-label={`Rent unit ${u.unitNumber}, ${u.size}, available`}
                className={`${baseClass} cursor-pointer hover:ring-2 hover:ring-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive focus-visible:z-10`}
                style={{ ...cellStyle, touchAction: 'manipulation' }}
              >
                {label}
              </Link>
            )
          }

          return (
            <div
              key={u.id}
              title={`Unit ${u.unitNumber} — ${u.size} — ${s.label}`}
              className={baseClass}
              style={cellStyle}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
