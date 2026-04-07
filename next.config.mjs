/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'pdfkit', 'twilio', '@sendgrid/mail'],
  },
}

export default nextConfig
