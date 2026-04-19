import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TruckFlowUS',
    short_name: 'TruckFlowUS',
    description: 'Dump truck ticketing, dispatch, and invoicing',
    start_url: '/',
    display: 'standalone',
    background_color: '#1b1e22',
    theme_color: '#FFB500',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
