/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone is for self-hosting (Render) — Vercel uses its own output
  output: process.env.VERCEL ? undefined : 'standalone',
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'pdfkit', 'twilio', 'resend'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },
}

export default nextConfig
