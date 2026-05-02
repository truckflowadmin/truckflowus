import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.APP_URL || 'https://truckflowus.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Authenticated dispatcher routes
          '/dashboard',
          '/tickets',
          '/drivers',
          '/customers',
          '/invoices',
          '/reports',
          '/settings',
          '/sms',
          '/locked',
          '/jobs',
          '/fleet',
          '/expenses',
          '/tax',
          '/quarries',
          // Superadmin routes
          '/sa',
          // Driver portal (authenticated)
          '/d/portal',
          '/d/reset',
          // API endpoints
          '/api/',
          // Suspended / billing pages
          '/suspended',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/dashboard',
          '/tickets',
          '/drivers',
          '/customers',
          '/invoices',
          '/reports',
          '/settings',
          '/sms',
          '/locked',
          '/jobs',
          '/fleet',
          '/expenses',
          '/tax',
          '/quarries',
          '/sa',
          '/d/portal',
          '/d/reset',
          '/api/',
          '/suspended',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
