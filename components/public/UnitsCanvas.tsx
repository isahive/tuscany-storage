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
      </div>

      {/* Canvas */}
      <div
        className="relative"
        style={{ width: widthPx, height: heightPx }}
        role="img"
        aria-label="Facility map"
      >
        {units.map((u) => {
          const w = effW(u)
          const d = effD(u)
          const s = styleFor(u.status)
          return (
            <div
              key={u.id}
              title={`Unit ${u.unitNumber} — ${u.size} — ${s.label}`}
              className="absolute flex items-center justify-center overflow-hidden text-[10px] font-semibold leading-none transition-shadow hover:shadow-md"
              style={{
                left: u.gridX * cellPx,
                top: u.gridY * cellPx,
                width: w * cellPx,
                height: d * cellPx,
                backgroundColor: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
              }}
            >
              <span className="px-1 text-center">{u.unitNumber}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
