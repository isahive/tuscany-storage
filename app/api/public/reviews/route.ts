import { NextResponse } from 'next/server'

// Cache reviews for 1 hour to avoid hitting API limits
let cachedReviews: any = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  try {
    const now = Date.now()

    // Return cached data if fresh
    if (cachedReviews && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cachedReviews })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJg-ewDotOXIgRjzOllhslk_8'

    if (!apiKey) {
      // Dev mode — return fallback reviews
      return NextResponse.json({
        success: true,
        data: {
          rating: 5.0,
          totalReviews: 0,
          reviews: [],
          source: 'fallback',
        },
      })
    }

    // Use the new Places API (v1)
    const url = `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount,reviews&key=${apiKey}`

    const res = await fetch(url, {
      headers: {
        'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
      },
      next: { revalidate: 3600 }, // ISR cache 1 hour
    })

    if (!res.ok) {
      // Try legacy API as fallback
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,reviews&key=${apiKey}`
      const legacyRes = await fetch(legacyUrl)
      const legacyData = await legacyRes.json()

      if (legacyData.result) {
        const result = legacyData.result
        const data = {
          rating: result.rating ?? 5.0,
          totalReviews: result.user_ratings_total ?? 0,
          reviews: (result.reviews ?? []).map((r: any) => ({
            author: r.author_name,
            rating: r.rating,
            text: r.text,
            time: r.time,
            relativeTime: r.relative_time_description,
            profilePhoto: r.profile_photo_url,
          })),
          source: 'google',
        }
        cachedReviews = data
        cacheTimestamp = now
        return NextResponse.json({ success: true, data })
      }

      throw new Error('Google Places API failed')
    }

    const json = await res.json()
    const data = {
      rating: json.rating ?? 5.0,
      totalReviews: json.userRatingCount ?? 0,
      reviews: (json.reviews ?? []).map((r: any) => ({
        author: r.authorAttribution?.displayName ?? 'Customer',
        rating: r.rating,
        text: r.text?.text ?? r.originalText?.text ?? '',
        time: r.publishTime ? new Date(r.publishTime).getTime() / 1000 : 0,
        relativeTime: r.relativePublishTimeDescription ?? '',
        profilePhoto: r.authorAttribution?.photoUri ?? '',
      })),
      source: 'google',
    }

    cachedReviews = data
    cacheTimestamp = now

    return NextResponse.json({ success: true, data })
  } catch (error) {
    // On error, return cached data if available, otherwise fallback
    if (cachedReviews) {
      return NextResponse.json({ success: true, data: cachedReviews })
    }
    return NextResponse.json({
      success: true,
      data: {
        rating: 5.0,
        totalReviews: 0,
        reviews: [],
        source: 'fallback',
      },
    })
  }
}
