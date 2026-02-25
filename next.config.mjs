/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // All SPA routes resolve to the single page
      { source: '/free-play', destination: '/' },
      { source: '/free-play/game', destination: '/' },
      { source: '/quick-play', destination: '/' },
      { source: '/create', destination: '/' },
      { source: '/join', destination: '/' },
      { source: '/lobby', destination: '/' },
      { source: '/game', destination: '/' },
      { source: '/profile', destination: '/' },
      { source: '/leaderboard', destination: '/' },
    ];
  },
  async headers() {
    return [
      {
        // Cache static game assets for 1 year (immutable content-addressed files)
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
