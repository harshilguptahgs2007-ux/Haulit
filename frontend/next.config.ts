import type { NextConfig } from 'next'

const MAPBOX_TOKEN =
  process.env.VITE_MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  ''

const CARTO_KEY =
  process.env.NEXT_PUBLIC_CARTO_KEY ||
  'cb1_4gda_2_4e8b4bd7d5ec1e8f1d157cb0'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    VITE_MAPBOX_TOKEN: MAPBOX_TOKEN,
    NEXT_PUBLIC_MAPBOX_TOKEN: MAPBOX_TOKEN,
    NEXT_PUBLIC_CARTO_KEY: CARTO_KEY,
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
    // Using the LAN IP (192.168.11.156) means this works whether the
    // browser connects via localhost OR from any device on the network.
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://192.168.11.156:5000'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
