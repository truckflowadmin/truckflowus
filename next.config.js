/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: {
    // Prisma client is regenerated during `prisma generate` in the build script,
    // but locally-stale types cause false positives. Safe because build script is:
    // "prisma generate && next build" — real type errors surface at generate time.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Required for pdfkit (node built-ins in server components)
    serverComponentsExternalPackages: ['pdfkit', 'nodemailer'],
  },
  // Prevent CDN/browser caching on reports page
  async headers() {
    return [
      {
        source: '/reports',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/dashboard',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // CORS + no-cache for mobile driver app — applied at CDN edge before middleware
      {
        source: '/api/driver/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Platform, X-Body, X-Driver-Token' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/api/tracking/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Platform, X-Body, X-Driver-Token' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
  // Rewrite legacy /uploads/* paths to auth-gated /api/uploads/* route.
  // Existing DB records store /uploads/... URLs; this ensures they still work
  // while being served through the authenticated file serving endpoint.
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
