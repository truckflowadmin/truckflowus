import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/quarries/suggest?lat=26.14&lng=-81.79&radius=50
 *
 * Searches OpenStreetMap (Overpass API) for quarries, mines, and
 * aggregate suppliers near the given coordinates. Free, no API key needed.
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

  const radiusMeters = radiusMiles * 1609;

  try {
    // Overpass QL: find quarries, mines, and related industrial sites
    // Tags: landuse=quarry, man_made=mineshaft, industrial=mine,
    //        shop=aggregate, building=industrial with quarry/mine in name
    const overpassQuery = `
      [out:json][timeout:30];
      (
        node["landuse"="quarry"](around:${radiusMeters},${lat},${lng});
        way["landuse"="quarry"](around:${radiusMeters},${lat},${lng});
        node["man_made"="mineshaft"](around:${radiusMeters},${lat},${lng});
        way["man_made"="mineshaft"](around:${radiusMeters},${lat},${lng});
        node["industrial"="mine"](around:${radiusMeters},${lat},${lng});
        way["industrial"="mine"](around:${radiusMeters},${lat},${lng});
        node["craft"="stonemason"](around:${radiusMeters},${lat},${lng});
        way["craft"="stonemason"](around:${radiusMeters},${lat},${lng});
        node["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["landuse"](around:${radiusMeters},${lat},${lng});
        way["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["landuse"](around:${radiusMeters},${lat},${lng});
        node["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["industrial"](around:${radiusMeters},${lat},${lng});
        way["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["industrial"](around:${radiusMeters},${lat},${lng});
        node["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["shop"](around:${radiusMeters},${lat},${lng});
        way["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["shop"](around:${radiusMeters},${lat},${lng});
        node["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["office"](around:${radiusMeters},${lat},${lng});
        way["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["office"](around:${radiusMeters},${lat},${lng});
        node["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["amenity"](around:${radiusMeters},${lat},${lng});
        way["name"~"quarr|mine|gravel|aggregate|rock|sand|stone|asphalt|concrete|cement|limerock|crushed",i]["amenity"](around:${radiusMeters},${lat},${lng});
        node["name"~"vulcan|cemex|martin marietta|titan|rinker|preferred material|apac|ranger construct|florida rock",i](around:${radiusMeters},${lat},${lng});
        way["name"~"vulcan|cemex|martin marietta|titan|rinker|preferred material|apac|ranger construct|florida rock",i](around:${radiusMeters},${lat},${lng});
      );
      out center body;
    `;

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!overpassRes.ok) {
      const text = await overpassRes.text();
      console.error('Overpass API error:', overpassRes.status, text);
      return NextResponse.json({
        error: `Map search returned an error (${overpassRes.status}). Try again in a moment.`,
        suggestions: [],
      });
    }

    const data = await overpassRes.json();
    const elements: any[] = data.elements || [];

    // Deduplicate by name (ways and nodes can overlap)
    const seen = new Map<string, any>();
    for (const el of elements) {
      const name = el.tags?.name;
      if (!name) continue; // skip unnamed features

      const key = name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, el);
      }
    }

    // Also search Nominatim for businesses (better at finding named businesses)
    const nominatimResults = await searchNominatim(lat, lng, radiusMiles);
    for (const nr of nominatimResults) {
      const key = nr.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, nr);
      }
    }

    const suggestions = [];

    for (const el of seen.values()) {
      // Handle both Overpass elements and Nominatim results
      if (el._source === 'nominatim') {
        suggestions.push(el);
        continue;
      }

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const tags = el.tags || {};
      const addr = parseOsmAddress(tags);

      suggestions.push({
        placeId: `osm-${el.type}-${el.id}`,
        name: tags.name,
        address: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
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

    // Sort by distance
    suggestions.sort((a, b) => {
      if (!a.lat || !b.lat) return 0;
      const distA = Math.sqrt((a.lat - lat) ** 2 + ((a.lng ?? 0) - lng) ** 2);
      const distB = Math.sqrt((b.lat - lat) ** 2 + ((b.lng ?? 0) - lng) ** 2);
      return distA - distB;
    });

    return NextResponse.json({ suggestions: suggestions.slice(0, 30) });
  } catch (err) {
    console.error('Quarry suggestion error:', err);
    return NextResponse.json({
      error: 'Failed to search for quarries. Try again in a moment.',
      suggestions: [],
    });
  }
}

/* ── Nominatim search (better for named businesses) ── */
async function searchNominatim(lat: number, lng: number, radiusMiles: number): Promise<any[]> {
  const queries = [
    'quarry',
    'rock mine',
    'gravel sand aggregate',
    'concrete asphalt plant',
  ];

  const results: any[] = [];
  const seen = new Set<string>();

  // Calculate bounding box from center + radius
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
      url.searchParams.set('limit', '20');
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
    } catch {
      // Skip failed queries
    }
  }

  return results;
}

/* ── Helpers ─────────────────────────────────────────── */
function parseOsmAddress(tags: Record<string, string>) {
  return {
    street: tags['addr:street']
      ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim()
      : null,
    city: tags['addr:city'] || null,
    state: tags['addr:state'] ? stateAbbrev(tags['addr:state']) : null,
    zip: tags['addr:postcode'] || null,
  };
}

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
