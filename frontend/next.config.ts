import type { NextConfig } from 'next'

const MAPBOX_TOKEN =
  process.env.VITE_MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  ''

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:5000'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    VITE_MAPBOX_TOKEN: MAPBOX_TOKEN,
    NEXT_PUBLIC_MAPBOX_TOKEN: MAPBOX_TOKEN,
  },
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(MAPBOX_TOKEN),
      })
    )
    return config
  },
  async rewrites() {
    // Server-side proxy: Next.js forwards /api/* calls to Flask.
    // Defaults to 127.0.0.1:5000 when frontend and backend run on the same computer,
    // avoiding ETIMEDOUT failures from stale or unreachable LAN IP addresses.
    // Can be overridden via BACKEND_URL or NEXT_PUBLIC_API_URL if needed.
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
