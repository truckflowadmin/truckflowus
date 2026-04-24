/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
