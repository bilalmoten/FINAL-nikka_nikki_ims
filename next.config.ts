/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizeCss: true,
  },
}

export default nextConfig
