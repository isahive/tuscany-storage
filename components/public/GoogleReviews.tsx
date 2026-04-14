'use client'

import { useState, useEffect } from 'react'

interface Review {
  author: string
  rating: number
  text: string
  time: number
  relativeTime: string
  profilePhoto: string
}

interface ReviewData {
  rating: number
  totalReviews: number
  reviews: Review[]
  source: string
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < rating ? 'text-amber-400' : 'text-mid'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function GoogleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function GoogleReviews() {
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/public/reviews')
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const FALLBACK: Review[] = [
    { author: 'Sarah M.', rating: 5, text: "Clean, safe, and the staff is incredibly helpful. I've stored here for 2 years and wouldn't go anywhere else.", relativeTime: '', profilePhoto: '', time: 0 },
    { author: 'James T.', rating: 5, text: 'The climate-controlled unit kept all my furniture in perfect condition during our home renovation. Worth every penny.', relativeTime: '', profilePhoto: '', time: 0 },
    { author: 'Linda R.', rating: 5, text: 'Online bill pay makes it so easy. I barely have to think about it. Great facility with great prices.', relativeTime: '', profilePhoto: '', time: 0 },
  ]

  const reviews = data?.reviews?.length ? data.reviews : FALLBACK
  const rating = data?.rating ?? 5.0
  const totalReviews = data?.totalReviews ?? 0
  const isGoogle = data?.source === 'google' && data.reviews.length > 0

  // Skeleton loading
  if (loading) {
    return (
      <section className="bg-cream py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto h-8 w-56 animate-pulse rounded-lg bg-mid/60" />
            <div className="mx-auto mt-4 h-5 w-40 animate-pulse rounded-lg bg-mid/40" />
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-cream py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-5 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-tan/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-tan/60" />
            <div className="h-px w-12 bg-tan/40" />
          </div>
          <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl lg:text-5xl">
            What Our Customers Say
          </h2>

          {/* Rating summary */}
          <div className="mt-6 inline-flex items-center gap-4 rounded-full border border-mid/60 bg-white px-6 py-3 shadow-sm">
            {isGoogle && <GoogleIcon className="h-5 w-5" />}
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-brown">{rating.toFixed(1)}</span>
              <Stars rating={Math.round(rating)} />
            </div>
            {totalReviews > 0 && (
              <>
                <div className="h-5 w-px bg-mid" />
                <span className="text-sm text-muted">{totalReviews} reviews</span>
              </>
            )}
          </div>
        </div>

        {/* Reviews grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 6).map((review, idx) => (
            <article
              key={idx}
              className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-mid/40 transition-shadow duration-200 hover:shadow-md"
            >
              {/* Author row — top */}
              <div className="mb-5 flex items-center gap-4">
                {review.profilePhoto ? (
                  <img
                    src={review.profilePhoto}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-mid/30"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brown/5 ring-2 ring-mid/30">
                    <span className="font-serif text-lg font-bold text-tan">
                      {review.author.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brown">{review.author}</p>
                  {review.relativeTime ? (
                    <p className="text-xs text-muted">{review.relativeTime}</p>
                  ) : (
                    <p className="text-xs text-muted">Verified customer</p>
                  )}
                </div>
                {isGoogle && (
                  <GoogleIcon className="h-5 w-5 flex-shrink-0 opacity-40" />
                )}
              </div>

              {/* Stars */}
              <Stars rating={review.rating} />

              {/* Review text — grows to fill */}
              <p className="mt-4 flex-1 text-[15px] leading-relaxed text-muted">
                {review.text}
              </p>
            </article>
          ))}
        </div>

        {/* CTA — view all on Google */}
        {isGoogle && (
          <div className="mt-12 text-center">
            <a
              href="https://search.google.com/local/reviews?placeid=ChIJg-ewDotOXIgRjzOllhslk_8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full border border-mid/60 bg-white px-7 py-3 text-sm font-medium text-brown shadow-sm transition-all duration-200 hover:border-tan/40 hover:shadow-md"
            >
              <GoogleIcon />
              See all {totalReviews} reviews on Google
              <svg className="h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
