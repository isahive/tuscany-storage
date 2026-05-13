import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map — Tuscany Village Self Storage",
  description:
    "Find Tuscany Village Self Storage at 2519 TN-116, Caryville, TN 37714.",
};

export default function MapPage() {
  return (
    <div className="bg-gray-100 pt-12 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Map embed */}
          <div className="w-full lg:w-[58%]">
            <iframe
              src="https://maps.google.com/maps?q=Tuscany+Village+Self+Storage+2519+TN-116+Caryville+TN+37714&t=m&z=15&output=embed"
              width="93%"
              height="620"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Tuscany Village Self Storage location map"
            />
          </div>

          {/* Text */}
          <div className="w-full pt-2 lg:w-[42%] lg:-ml-12">
            <h1 className="text-2xl font-semibold text-olive">
              Tuscany Village Self Storage
            </h1>
            <p className="mt-3 text-gray-700">
              Our facility is conveniently located close to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
