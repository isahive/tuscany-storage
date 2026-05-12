"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const GRID_COLS = 20;
const GRID_ROWS = 12;
const CELL_PX = 52;

const STATUS_CFG: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  available: {
    bg: "#D1FAE5",
    border: "#6EE7B7",
    text: "#065F46",
    label: "Available",
  },
  occupied: {
    bg: "#DBEAFE",
    border: "#93C5FD",
    text: "#1E3A5F",
    label: "Occupied",
  },
  maintenance: {
    bg: "#FEF3C7",
    border: "#FCD34D",
    text: "#92400E",
    label: "Maintenance",
  },
  reserved: {
    bg: "#EDE9FE",
    border: "#C4B5FD",
    text: "#3B0764",
    label: "Reserved",
  },
};

interface UnitCell {
  _id: string;
  unitNumber: string;
  size: string;
  sqft: number;
  type: string;
  price: number;
  status: string;
  features: string[];
  gridX?: number;
  gridY?: number;
  gridFloor?: number;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function PublicSiteMapPage() {
  const [units, setUnits] = useState<UnitCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [selected, setSelected] = useState<UnitCell | null>(null);

  useEffect(() => {
    fetch("/api/units?limit=200")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setUnits(j.data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const floors = useMemo(() => {
    const s = new Set<number>();
    for (const u of units) {
      if (typeof u.gridFloor === "number") s.add(u.gridFloor);
    }
    const arr = Array.from(s).sort();
    return arr.length > 0 ? arr : [1];
  }, [units]);

  const gridMap = useMemo(() => {
    const map = new Map<string, UnitCell>();
    for (const u of units) {
      if (
        typeof u.gridX === "number" &&
        typeof u.gridY === "number" &&
        typeof u.gridFloor === "number" &&
        u.gridFloor === currentFloor
      ) {
        map.set(`${u.gridX}:${u.gridY}`, u);
      }
    }
    return map;
  }, [units, currentFloor]);

  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, maintenance: 0, reserved: 0 };
    for (const u of units) {
      if (u.status in c) c[u.status as keyof typeof c]++;
    }
    return c;
  }, [units]);

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-24">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-tan" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Tuscany Village Self Storage
            </p>
            <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl lg:text-6xl">
              Facility Site Map
            </h1>
            <p className="mt-4 text-lg text-cream/50">
              Visual layout of all storage units. Click any available unit to
              reserve.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-cream">
        <div className="mx-auto max-w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {/* Legend + floor selector */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CFG).map(([status, cfg]) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: cfg.bg,
                    borderColor: cfg.border,
                    color: cfg.text,
                  }}
                >
                  {cfg.label}
                  {counts[status as keyof typeof counts] > 0 && (
                    <span className="font-bold">
                      ({counts[status as keyof typeof counts]})
                    </span>
                  )}
                </span>
              ))}
            </div>
            {floors.length > 1 && (
              <div className="ml-auto flex gap-2">
                {floors.map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setCurrentFloor(f);
                      setSelected(null);
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                      currentFloor === f
                        ? "bg-tan text-brown shadow-md"
                        : "border border-mid bg-white text-muted hover:border-tan/40"
                    }`}
                  >
                    Floor {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mid border-t-tan" />
              <span className="ml-3 text-muted">Loading site map…</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* Grid */}
              <div className="flex-1 overflow-x-auto rounded-2xl border border-mid/60 bg-[#F1F5F9] p-2 shadow-sm">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_PX}px)`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_PX}px)`,
                    gap: "2px",
                    width: "fit-content",
                    margin: "0 auto",
                  }}
                >
                  {Array.from({ length: GRID_ROWS }, (_, row) =>
                    Array.from({ length: GRID_COLS }, (_, col) => {
                      const key = `${col}:${row}`;
                      const unit = gridMap.get(key) ?? null;
                      const cfg = unit ? STATUS_CFG[unit.status] : null;

                      return (
                        <div
                          key={key}
                          onClick={() => {
                            if (unit)
                              setSelected(unit === selected ? null : unit);
                          }}
                          style={{
                            width: CELL_PX,
                            height: CELL_PX,
                            border: `1px solid ${cfg?.border ?? "#E2E8F0"}`,
                            backgroundColor:
                              unit && selected?._id === unit._id
                                ? cfg?.border
                                : (cfg?.bg ?? "#F8FAFC"),
                            cursor: unit ? "pointer" : "default",
                            boxSizing: "border-box",
                            padding: "3px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            transition: "box-shadow 0.1s",
                          }}
                          className={unit ? "hover:shadow-md" : ""}
                        >
                          {unit && cfg ? (
                            <>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: "0.6rem",
                                  color: cfg.text,
                                  lineHeight: 1.1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {unit.unitNumber}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.55rem",
                                  color: cfg.text,
                                  opacity: 0.75,
                                  lineHeight: 1.1,
                                }}
                              >
                                {unit.size}
                              </span>
                            </>
                          ) : null}
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>

              {/* Unit detail panel */}
              {selected ? (
                <div className="w-full shrink-0 rounded-2xl border border-mid/60 bg-white p-6 shadow-sm lg:w-72">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="font-serif text-2xl font-bold text-brown">
                        Unit {selected.unitNumber}
                      </p>
                      <span
                        className="mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor:
                            STATUS_CFG[selected.status]?.bg ?? "#F3F4F6",
                          borderColor:
                            STATUS_CFG[selected.status]?.border ?? "#E5E7EB",
                          color: STATUS_CFG[selected.status]?.text ?? "#374151",
                        }}
                      >
                        {STATUS_CFG[selected.status]?.label ?? selected.status}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="rounded-full p-1 text-muted hover:bg-mid/40 hover:text-brown"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Size</span>
                      <span className="font-medium text-brown">
                        {selected.size}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Area</span>
                      <span className="font-medium text-brown">
                        {selected.sqft} sq ft
                      </span>
                    </div>
                    {selected.status === "available" && (
                      <div className="flex justify-between">
                        <span className="text-muted">Rate</span>
                        <span className="font-semibold text-brown">
                          {formatMoney(selected.price)}/mo
                        </span>
                      </div>
                    )}
                  </div>
                  {selected.features.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {selected.features.slice(0, 4).map((f) => (
                        <span
                          key={f}
                          className="rounded-full border border-mid px-2.5 py-0.5 text-xs text-muted"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {selected.status === "available" && (
                    <Link
                      href={`/units/${selected._id}`}
                      className="mt-5 block rounded-full bg-brown py-2.5 text-center text-sm font-semibold text-cream transition-all hover:bg-tan hover:text-brown"
                    >
                      Reserve This Unit
                    </Link>
                  )}
                  {selected.status !== "available" && (
                    <Link
                      href="/waiting-list"
                      className="mt-5 block rounded-full border border-tan py-2.5 text-center text-sm font-semibold text-tan transition-all hover:bg-tan hover:text-brown"
                    >
                      Join Waiting List
                    </Link>
                  )}
                </div>
              ) : (
                <div className="hidden w-72 shrink-0 rounded-2xl border border-dashed border-mid/60 bg-white/50 p-6 lg:flex lg:items-center lg:justify-center">
                  <p className="text-center text-sm text-muted">
                    Click any unit cell to see details
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-muted">
            {GRID_COLS} × {GRID_ROWS} grid &bull; Click a colored cell to see
            unit details
          </p>

          {/* CTA */}
          {counts.available > 0 && (
            <div className="mt-8 inline-flex items-center gap-4 rounded-2xl border border-[#6EE7B7] bg-[#D1FAE5] px-6 py-4">
              <span className="text-sm font-medium text-[#065F46]">
                {counts.available} unit{counts.available !== 1 ? "s" : ""}{" "}
                currently available
              </span>
              <Link
                href="/units"
                className="rounded-full bg-[#065F46] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#047857]"
              >
                Browse &amp; Reserve
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
