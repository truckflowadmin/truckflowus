/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Required for pdfkit (node built-ins in server components)
    serverComponentsExternalPackages: ['pdfkit', 'nodemailer'],
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
