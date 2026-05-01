import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/quarries/suggest?lat=26.14&lng=-81.79&radius=50
 *
 * Searches Google Places for quarries, mines, and aggregate suppliers
 * near the given coordinates. Returns up to 20 results.
 */
export async function GET(req: NextRequest) {
  await requireSession();

  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const radiusMiles = parseInt(searchParams.get('radius') || '50', 10);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: 'Google Maps API key not configured',
      suggestions: [],
    });
  }

  const radiusMeters = Math.min(radiusMiles * 1609, 50000); // max 50km per request

  try {
    // Search for quarries/mines/aggregate using multiple queries for best coverage
    const queries = [
      'quarry rock mine aggregate',
      'sand gravel stone supplier',
      'concrete asphalt materials',
    ];

    const allPlaces = new Map<string, any>();
    let lastApiError = '';

    for (const query of queries) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.set('query', query);
      url.searchParams.set('location', `${lat},${lng}`);
      url.searchParams.set('radius', String(radiusMeters));
      url.searchParams.set('type', 'establishment');
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        lastApiError = `Google API returned HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      if (data.status === 'REQUEST_DENIED') {
        lastApiError = data.error_message || 'Places API not enabled. Enable "Places API" in Google Cloud Console for your API key.';
        continue;
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        lastApiError = 'Google Places API quota exceeded. Try again later.';
        continue;
      }
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        lastApiError = `Google API error: ${data.status} — ${data.error_message || ''}`;
        continue;
      }

      for (const place of data.results || []) {
        if (!allPlaces.has(place.place_id)) {
          allPlaces.set(place.place_id, place);
        }
      }
    }

    // If no results and we had API errors, report them
    if (allPlaces.size === 0 && lastApiError) {
      return NextResponse.json({ error: lastApiError, suggestions: [] });
    }

    // Get details for each place (phone, website, hours)
    const suggestions = [];

    for (const place of allPlaces.values()) {
      // Get place details for phone/website/hours
      let phone = null;
      let website = null;
      let hoursOfOp = null;

      try {
        const detailUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailUrl.searchParams.set('place_id', place.place_id);
        detailUrl.searchParams.set('fields', 'formatted_phone_number,website,opening_hours,url');
        detailUrl.searchParams.set('key', apiKey);

        const detailRes = await fetch(detailUrl.toString());
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          if (detailData.result) {
            phone = detailData.result.formatted_phone_number || null;
            website = detailData.result.website || null;
            if (detailData.result.opening_hours?.weekday_text) {
              // Compress to a short string like "Mon-Fri 6am-5pm"
              hoursOfOp = detailData.result.opening_hours.weekday_text.join(', ');
            }
          }
        }
      } catch {
        // Skip details if they fail
      }

      const loc = place.geometry?.location;
      const addressParts = (place.formatted_address || '').split(',').map((s: string) => s.trim());

      suggestions.push({
        placeId: place.place_id,
        name: place.name,
        address: addressParts[0] || null,
        city: addressParts[1] || null,
        state: addressParts[2]?.split(' ')[0] || null,
        zip: addressParts[2]?.split(' ')[1] || null,
        lat: loc?.lat || null,
        lng: loc?.lng || null,
        phone,
        website,
        hoursOfOp,
        rating: place.rating || null,
        totalRatings: place.user_ratings_total || 0,
        types: place.types || [],
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      });
    }

    // Sort by distance from search point
    suggestions.sort((a, b) => {
      if (!a.lat || !b.lat) return 0;
      const distA = Math.sqrt((a.lat - lat) ** 2 + (a.lng - lng) ** 2);
      const distB = Math.sqrt((b.lat - lat) ** 2 + (b.lng - lng) ** 2);
      return distA - distB;
    });

    return NextResponse.json({ suggestions: suggestions.slice(0, 20) });
  } catch (err) {
    console.error('Quarry suggestion error:', err);
    return NextResponse.json({ error: 'Failed to search for quarries', suggestions: [] });
  }
}
