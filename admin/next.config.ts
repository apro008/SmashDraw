import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The panel is a private tool — never let a search engine index it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
