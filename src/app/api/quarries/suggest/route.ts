import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/quarries/suggest?lat=26.14&lng=-81.79&radius=50
 *
 * Searches OpenStreetMap for quarries, mines, and aggregate suppliers
 * near the given coordinates. Uses Nominatim + Overpass. Free, no API key.
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

  try {
    const seen = new Map<string, any>();

    // 1) Nominatim — best for finding named businesses
    const nominatimResults = await searchNominatim(lat, lng, radiusMiles);
    for (const r of nominatimResults) {
      const key = r.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, r);
    }

    // 2) Overpass — finds tagged quarry/mine landuse features
    const overpassResults = await searchOverpass(lat, lng, radiusMiles);
    for (const r of overpassResults) {
      const key = r.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, r);
    }

    const suggestions = [...seen.values()];

    // Sort by distance
    suggestions.sort((a, b) => {
      const distA = a.lat ? Math.sqrt((a.lat - lat) ** 2 + ((a.lng ?? 0) - lng) ** 2) : 999;
      const distB = b.lat ? Math.sqrt((b.lat - lat) ** 2 + ((b.lng ?? 0) - lng) ** 2) : 999;
      return distA - distB;
    });

    // Remove internal fields
    const clean = suggestions.slice(0, 30).map(({ _source, ...rest }) => rest);

    return NextResponse.json({ suggestions: clean });
  } catch (err) {
    console.error('Quarry suggestion error:', err);
    return NextResponse.json({
      error: 'Failed to search for quarries. Try again in a moment.',
      suggestions: [],
    });
  }
}

/* ── Nominatim search ────────────────────────────────── */
async function searchNominatim(lat: number, lng: number, radiusMiles: number): Promise<any[]> {
  const queries = [
    'quarry',
    'rock mine',
    'gravel pit',
    'aggregate supplier',
    'sand gravel',
    'concrete plant',
    'asphalt plant',
    'crushed stone',
    'limerock',
  ];

  const results: any[] = [];
  const seen = new Set<string>();

  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));
  const viewbox = `${lng - lngDelta},${lat + latDelta},${lng + lngDelta},${lat - latDelta}`;

  for (const query of queries) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('extratags', '1');
      url.searchParams.set('limit', '15');
      url.searchParams.set('viewbox', viewbox);
      url.searchParams.set('bounded', '1');
      url.searchParams.set('countrycodes', 'us');

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'TruckFlowUS/1.0 (dispatch@truckflowus.com)' },
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const place of data) {
        const name = place.name || place.display_name?.split(',')[0];
        if (!name) continue;
        const key = name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);

        const addr = place.address || {};
        results.push({
          _source: 'nominatim',
          placeId: `nom-${place.osm_type}-${place.osm_id}`,
          name,
          address: addr.road ? `${addr.house_number || ''} ${addr.road}`.trim() : null,
          city: addr.city || addr.town || addr.village || addr.county || null,
          state: addr.state ? stateAbbrev(addr.state) : null,
          zip: addr.postcode || null,
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon),
          phone: place.extratags?.phone || place.extratags?.['contact:phone'] || null,
          website: place.extratags?.website || place.extratags?.['contact:website'] || null,
          hoursOfOp: place.extratags?.opening_hours || null,
          rating: null,
          totalRatings: 0,
          mapsUrl: `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`,
        });
      }

      // Small delay between Nominatim requests (usage policy: 1 req/sec)
      await new Promise((r) => setTimeout(r, 1100));
    } catch {
      // Skip failed queries
    }
  }

  return results;
}

/* ── Overpass search (tagged quarry/mine features) ──── */
async function searchOverpass(lat: number, lng: number, radiusMiles: number): Promise<any[]> {
  const radiusMeters = radiusMiles * 1609;

  // Keep the query simple to avoid 406/429 errors
  const query = [
    '[out:json][timeout:25];',
    '(',
    `  nwr["landuse"="quarry"](around:${radiusMeters},${lat},${lng});`,
    `  nwr["man_made"="mineshaft"](around:${radiusMeters},${lat},${lng});`,
    `  nwr["industrial"="mine"](around:${radiusMeters},${lat},${lng});`,
    ');',
    'out center tags 50;',
  ].join('');

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.error('Overpass error:', res.status);
      return [];
    }

    const data = await res.json();
    const results: any[] = [];

    for (const el of data.elements || []) {
      const name = el.tags?.name;
      if (!name) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const tags = el.tags || {};

      results.push({
        _source: 'overpass',
        placeId: `osm-${el.type}-${el.id}`,
        name,
        address: tags['addr:street']
          ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim()
          : null,
        city: tags['addr:city'] || null,
        state: tags['addr:state'] ? stateAbbrev(tags['addr:state']) : null,
        zip: tags['addr:postcode'] || null,
        lat: elLat,
        lng: elLng,
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || null,
        hoursOfOp: tags.opening_hours || null,
        rating: null,
        totalRatings: 0,
        mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      });
    }

    return results;
  } catch (err) {
    console.error('Overpass fetch failed:', err);
    return [];
  }
}

/* ── Helpers ─────────────────────────────────────────── */
const STATE_MAP: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
};

function stateAbbrev(state: string): string {
  if (state.length === 2) return state.toUpperCase();
  return STATE_MAP[state.toLowerCase()] || state;
}
