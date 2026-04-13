import type { MetadataRoute } from 'next'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tuscanystorage.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connectDB()
  const units = await Unit.find({ status: { $in: ['available', 'occupied', 'reserved'] } }).select('_id updatedAt').lean()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/units`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/size-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/how-it-works`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/waiting-list`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  const unitRoutes: MetadataRoute.Sitemap = units.map((u: any) => ({
    url: `${BASE_URL}/units/${u._id}`,
    lastModified: u.updatedAt ?? new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [...staticRoutes, ...unitRoutes]
}
