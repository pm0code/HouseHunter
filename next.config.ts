import type { NextConfig } from 'next';

const config: NextConfig = {
  // Serve large PMTiles files efficiently
  async headers() {
    return [
      {
        source: '/tiles/:path*',
        headers: [
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  // maplibre-gl ships ESM; Next.js needs to transpile it for SSR compatibility
  transpilePackages: ['maplibre-gl'],
};

export default config;
