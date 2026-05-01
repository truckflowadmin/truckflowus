import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/quarries/suggest?lat=26.14&lng=-81.79&radius=50
 * GET /api/quarries/suggest?q=vulcan+materials          ← name search
 * GET /api/quarries/suggest?q=vulcan&lat=26.14&lng=-81.79  ← name + location
 *
 * Searches OpenStreetMap for quarries, mines, and aggregate suppliers.
 * If `q` is provided, searches by name (Nominatim only).
 * If only lat/lng is provided, searches nearby (Nominatim + Overpass + known).
 */
export async function GET(req: NextRequest) {
  await requireSession();

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get('q') || '').trim();
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const radiusMiles = parseInt(searchParams.get('radius') || '50', 10);

  // Name-based search mode
  if (q) {
    try {
      const results = await searchByName(q, isNaN(lat) ? null : lat, isNaN(lng) ? null : lng);
      return NextResponse.json({ suggestions: results });
    } catch (err) {
      console.error('Quarry name search error:', err);
      return NextResponse.json({
        error: 'Search failed. Try again in a moment.',
        suggestions: [],
      });
    }
  }

  // Location-based search mode (original behavior)
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    const seen = new Map<string, any>();

    // 1) Known quarries — curated data with verified contact info
    const knownResults = getKnownQuarries(lat, lng, radiusMiles);
    for (const r of knownResults) {
      const key = r.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, r);
    }

    // 2) Nominatim — finds named businesses on OpenStreetMap
    const nominatimResults = await searchNominatim(lat, lng, radiusMiles);
    for (const r of nominatimResults) {
      const key = r.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, r);
    }

    // 3) Overpass — finds tagged quarry/mine landuse features
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

/* ── Name-based search (Nominatim + known quarries) ── */
async function searchByName(query: string, lat: number | null, lng: number | null): Promise<any[]> {
  const seen = new Map<string, any>();
  const lowerQ = query.toLowerCase();

  // 1) Check known quarries by name match
  for (const q of KNOWN_QUARRIES) {
    if (q.name.toLowerCase().includes(lowerQ) ||
        q.city.toLowerCase().includes(lowerQ) ||
        q.materials.some((m) => m.toLowerCase().includes(lowerQ))) {
      const key = q.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, {
          placeId: `known-${q.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: q.name,
          address: q.address,
          city: q.city,
          state: q.state,
          zip: q.zip,
          lat: q.lat,
          lng: q.lng,
          phone: q.phone,
          website: q.website,
          hoursOfOp: q.hoursOfOp,
          rating: null,
          totalRatings: 0,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${q.lat},${q.lng}`,
        });
      }
    }
  }

  // 2) Nominatim search — broader, US-wide
  try {
    const searchTerms = [`${query} quarry`, `${query} mine`, query];
    for (const term of searchTerms) {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', term);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('extratags', '1');
      url.searchParams.set('limit', '10');
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

        const addr = place.address || {};
        seen.set(key, {
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

      await new Promise((r) => setTimeout(r, 1100));
    }
  } catch { /* skip */ }

  let results = [...seen.values()];

  // Sort by distance from company if coords provided, otherwise alphabetical
  if (lat != null && lng != null) {
    results.sort((a, b) => {
      const distA = a.lat ? haversineDistance(lat, lng, a.lat, a.lng ?? 0) : 99999;
      const distB = b.lat ? haversineDistance(lat, lng, b.lat, b.lng ?? 0) : 99999;
      return distA - distB;
    });
  } else {
    results.sort((a, b) => a.name.localeCompare(b.name));
  }

  return results.slice(0, 30);
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

/* ── Haversine distance (miles) ────────────────────── */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Known quarries (curated, verified contact info) ── */
const KNOWN_QUARRIES = [
  {
    name: 'Vulcan Materials – Naples',
    address: '3571 Shawnee Rd',
    city: 'Naples',
    state: 'FL',
    zip: '34120',
    lat: 26.2101,
    lng: -81.6656,
    phone: '(239) 455-1050',
    website: 'https://www.vulcanmaterials.com',
    hoursOfOp: 'Mon-Fri 6:00 AM – 5:00 PM',
    materials: ['Crushed Stone', 'Aggregates', 'Asphalt'],
  },
  {
    name: 'Bonness Company',
    address: '1990 Seward Ave',
    city: 'Naples',
    state: 'FL',
    zip: '34109',
    lat: 26.2028,
    lng: -81.7826,
    phone: '(239) 597-6221',
    website: 'https://www.bonness.com',
    hoursOfOp: 'Mon-Fri 7:00 AM – 5:00 PM',
    materials: ['Fill Dirt', 'Shell Rock', 'Crushed Concrete', 'Rip Rap'],
  },
  {
    name: 'Florida Rock Industries',
    address: '4125 State Rd 29 S',
    city: 'Immokalee',
    state: 'FL',
    zip: '34142',
    lat: 26.3570,
    lng: -81.4205,
    phone: '(239) 657-8718',
    website: null,
    hoursOfOp: 'Mon-Fri 6:00 AM – 4:30 PM',
    materials: ['Limerock', 'Base Rock', 'Fill'],
  },
  {
    name: 'Titan America – Pennsuco',
    address: '15001 NW 122nd Ave',
    city: 'Medley',
    state: 'FL',
    zip: '33178',
    lat: 25.8947,
    lng: -80.4420,
    phone: '(305) 364-2200',
    website: 'https://www.titanamerica.com',
    hoursOfOp: 'Mon-Fri 6:00 AM – 5:00 PM',
    materials: ['Cement', 'Aggregates', 'Ready Mix'],
  },
  {
    name: 'White Rock Quarries',
    address: '15801 Sheridan St',
    city: 'Southwest Ranches',
    state: 'FL',
    zip: '33331',
    lat: 26.0588,
    lng: -80.3550,
    phone: '(954) 680-2646',
    website: 'https://www.whiterockquarries.com',
    hoursOfOp: 'Mon-Fri 6:00 AM – 5:00 PM, Sat 6:00 AM – 12:00 PM',
    materials: ['Limerock', 'Rip Rap', 'Boulders', 'Fill', 'Shell Rock'],
  },
  {
    name: 'APAC Southeast (CRH)',
    address: '6897 Daniels Pkwy',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33912',
    lat: 26.5340,
    lng: -81.8202,
    phone: '(239) 332-1693',
    website: 'https://www.crhamericas.com',
    hoursOfOp: 'Mon-Fri 6:30 AM – 5:00 PM',
    materials: ['Asphalt', 'Aggregates', 'Road Base'],
  },
  {
    name: 'CEMEX – Fort Myers',
    address: '16760 Oriole Rd',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33912',
    lat: 26.5150,
    lng: -81.7880,
    phone: '(239) 267-0654',
    website: 'https://www.cemex.com',
    hoursOfOp: 'Mon-Fri 6:00 AM – 5:00 PM',
    materials: ['Ready Mix Concrete', 'Cement', 'Aggregates'],
  },
  {
    name: 'Vulcan Materials – Fort Myers',
    address: '17800 Ben Hill Griffin Pkwy',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33913',
    lat: 26.4900,
    lng: -81.6750,
    phone: '(239) 690-2255',
    website: 'https://www.vulcanmaterials.com',
    hoursOfOp: 'Mon-Fri 6:00 AM – 5:00 PM',
    materials: ['Crushed Stone', 'Sand', 'Gravel'],
  },
  {
    name: 'Quality Enterprises USA',
    address: '3894 Mannix Dr',
    city: 'Naples',
    state: 'FL',
    zip: '34114',
    lat: 26.0890,
    lng: -81.7125,
    phone: '(239) 435-7200',
    website: 'https://www.qualityenterprises.com',
    hoursOfOp: 'Mon-Fri 7:00 AM – 5:00 PM',
    materials: ['Fill', 'Shell Rock', 'Base Rock', 'Asphalt'],
  },
  {
    name: 'Ranger Construction Industries',
    address: '3600 Prospect Ave',
    city: 'Naples',
    state: 'FL',
    zip: '34104',
    lat: 26.1660,
    lng: -81.7660,
    phone: '(239) 643-4337',
    website: 'https://www.rangerconstruction.com',
    hoursOfOp: 'Mon-Fri 7:00 AM – 5:00 PM',
    materials: ['Asphalt', 'Road Materials', 'Base Rock'],
  },
  {
    name: 'Martin Marietta Materials',
    address: '2550 Immokalee Rd',
    city: 'Naples',
    state: 'FL',
    zip: '34110',
    lat: 26.2700,
    lng: -81.7485,
    phone: '(239) 596-3740',
    website: 'https://www.martinmarietta.com',
    hoursOfOp: 'Mon-Fri 6:30 AM – 4:30 PM',
    materials: ['Aggregates', 'Crushed Stone', 'Sand'],
  },
  {
    name: 'Bergeron Land Development',
    address: '850 NW 27th Ave',
    city: 'Fort Lauderdale',
    state: 'FL',
    zip: '33311',
    lat: 26.1233,
    lng: -80.1765,
    phone: '(954) 584-1081',
    website: 'https://www.bergeronland.com',
    hoursOfOp: 'Mon-Fri 6:00 AM – 5:00 PM',
    materials: ['Fill', 'Crushed Concrete', 'Limerock', 'Boulders'],
  },
  {
    name: 'Preferred Materials',
    address: '5700 Shirley St',
    city: 'Naples',
    state: 'FL',
    zip: '34109',
    lat: 26.2203,
    lng: -81.7730,
    phone: '(239) 594-3256',
    website: 'https://www.preferredmaterials.com',
    hoursOfOp: 'Mon-Fri 6:30 AM – 5:00 PM',
    materials: ['Asphalt', 'Aggregates', 'Concrete'],
  },
  {
    name: 'Rinker Materials (Quikrete)',
    address: '3501 1st Ave SW',
    city: 'Naples',
    state: 'FL',
    zip: '34117',
    lat: 26.1380,
    lng: -81.8100,
    phone: '(239) 643-7321',
    website: 'https://www.quikrete.com',
    hoursOfOp: 'Mon-Fri 7:00 AM – 4:00 PM',
    materials: ['Concrete Block', 'Ready Mix', 'Pavers'],
  },
  {
    name: 'Collier Paving & Concrete',
    address: '3400 Shawnee Rd',
    city: 'Naples',
    state: 'FL',
    zip: '34120',
    lat: 26.2060,
    lng: -81.6670,
    phone: '(239) 455-4242',
    website: 'https://www.collierpaving.com',
    hoursOfOp: 'Mon-Fri 6:30 AM – 5:00 PM',
    materials: ['Concrete', 'Asphalt', 'Base Rock', 'Fill'],
  },
];

function getKnownQuarries(lat: number, lng: number, radiusMiles: number): any[] {
  return KNOWN_QUARRIES
    .filter((q) => haversineDistance(lat, lng, q.lat, q.lng) <= radiusMiles)
    .map((q) => ({
      _source: 'known',
      placeId: `known-${q.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: q.name,
      address: q.address,
      city: q.city,
      state: q.state,
      zip: q.zip,
      lat: q.lat,
      lng: q.lng,
      phone: q.phone,
      website: q.website,
      hoursOfOp: q.hoursOfOp,
      rating: null,
      totalRatings: 0,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${q.lat},${q.lng}`,
    }));
}
