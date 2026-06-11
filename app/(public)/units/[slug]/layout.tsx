import type { Metadata } from 'next'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle Storage',
}

const FALLBACK: Metadata = {
  title: 'Storage Unit Details',
  description:
    'View storage unit details, features, pricing, and availability at Tuscany Village Self Storage in Caryville, TN. Reserve online today.',
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  try {
    await connectDB()
    const unit = await Unit.findById(params.slug)
      .select('unitNumber size sqft type price status')
      .lean() as { unitNumber: string; size: string; sqft: number; type: string; price: number; status: string } | null

    if (!unit) return FALLBACK

    const typeLabel = TYPE_LABELS[unit.type] ?? 'Storage'
    const monthly = `$${(unit.price / 100) % 1 === 0 ? unit.price / 100 : (unit.price / 100).toFixed(2)}/mo`
    const availability = unit.status === 'available' ? 'Available now' : 'Currently occupied — join the waiting list'

    return {
      title: `${unit.size} ${typeLabel} Unit ${unit.unitNumber} — ${monthly}`,
      description: `${unit.size} (${unit.sqft} sq ft) ${typeLabel.toLowerCase()} storage unit for ${monthly} at Tuscany Village Self Storage in Caryville, TN. ${availability}. Month-to-month, 24/7 gate access.`,
      alternates: { canonical: `/units/${params.slug}` },
      openGraph: {
        title: `${unit.size} ${typeLabel} Unit ${unit.unitNumber} — ${monthly}`,
        description: `${unit.size} (${unit.sqft} sq ft) ${typeLabel.toLowerCase()} storage in Caryville, TN. ${availability}.`,
        url: `/units/${params.slug}`,
      },
    }
  } catch {
    // Invalid ObjectId or DB hiccup — fall back to the generic metadata.
    return FALLBACK
  }
}

export default function UnitDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
