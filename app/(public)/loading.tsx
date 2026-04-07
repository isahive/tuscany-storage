export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Hero skeleton */}
      <div className="bg-brown">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="h-10 w-3/4 bg-white/10 rounded animate-pulse" />
              <div className="h-6 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-6 w-2/3 bg-white/10 rounded animate-pulse" />
              <div className="h-12 w-40 bg-white/10 rounded animate-pulse mt-6" />
            </div>
            <div className="h-64 bg-white/10 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="h-8 w-48 bg-mid rounded animate-pulse mx-auto mb-8" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-lg border border-mid animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
