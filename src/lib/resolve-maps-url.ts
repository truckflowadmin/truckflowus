/**
 * Resolves Google Maps short URLs to extract street addresses.
 *
 * Flow:
 * 1. Follow redirects on the short URL (maps.app.goo.gl/xxx)
 * 2. The final URL looks like:
 *    https://www.google.com/maps/place/Business+Name,+123+Street,+City,+State+ZIP/@lat,lng,...
 * 3. Parse the address out of the /place/ segment
 */

const MAPS_SHORT_URL_PATTERN = /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i;

/**
 * Check if a URL is a Google Maps short link
 */
export function isGoogleMapsShortUrl(url: string): boolean {
  return MAPS_SHORT_URL_PATTERN.test(url);
}

interface ResolvedAddress {
  /** Full address string (e.g. "3106 Horseshoe Dr N, Naples, FL 34104") */
  address: string | null;
  /** Business/place name if present */
  placeName: string | null;
  /** The full resolved URL */
  resolvedUrl: string;
}

/**
 * Resolve a Google Maps short URL and extract the address from the redirect target.
 *
 * Returns null if the URL cannot be resolved or parsed.
 */
export async function resolveGoogleMapsUrl(shortUrl: string): Promise<ResolvedAddress | null> {
  if (!shortUrl || !isGoogleMapsShortUrl(shortUrl)) {
    return null;
  }

  try {
    console.log('[resolve-maps] Resolving:', shortUrl);

    // Follow redirects to get the final URL
    const res = await fetch(shortUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Use a browser-like UA to get proper redirects
        'User-Agent': 'Mozilla/5.0 (compatible; TruckFlowUS/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });

    const finalUrl = res.url;
    console.log('[resolve-maps] Resolved to:', finalUrl);

    return parseGoogleMapsUrl(finalUrl);
  } catch (err: any) {
    console.error('[resolve-maps] Error resolving URL:', err.message);
    return null;
  }
}

/**
 * Parse address info from a full Google Maps URL.
 *
 * Handles these URL patterns:
 * - /maps/place/ENCODED+ADDRESS/@lat,lng,...
 * - /maps/place/ENCODED+ADDRESS/data=...
 * - /maps/@lat,lng,... (no address, just coords)
 * - /maps/dir/... (directions)
 */
export function parseGoogleMapsUrl(url: string): ResolvedAddress | null {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname);

    // Pattern: /maps/place/Some+Place+Name+Address/@lat,lng,...
    const placeMatch = path.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      const raw = placeMatch[1].replace(/\+/g, ' ').trim();
      return extractAddressFromPlaceString(raw, url);
    }

    // Pattern: /maps/search/ADDRESS
    const searchMatch = path.match(/\/maps\/search\/([^/@]+)/);
    if (searchMatch) {
      const raw = searchMatch[1].replace(/\+/g, ' ').trim();
      return {
        address: raw,
        placeName: null,
        resolvedUrl: url,
      };
    }

    // Couldn't parse — return the URL anyway
    console.log('[resolve-maps] Could not parse address from URL pattern');
    return { address: null, placeName: null, resolvedUrl: url };
  } catch {
    return null;
  }
}

/**
 * Given the raw place string from a Google Maps URL, separate the business name
 * from the street address.
 *
 * Examples:
 *   "Cemex East Trail, 1234 Trail Blvd, Naples, FL 34108"
 *     → placeName = "Cemex East Trail", address = "1234 Trail Blvd, Naples, FL 34108"
 *
 *   "1234 Trail Blvd, Naples, FL 34108"
 *     → placeName = null, address = "1234 Trail Blvd, Naples, FL 34108"
 *
 *   "Valencia Sky"
 *     → placeName = "Valencia Sky", address = null
 */
function extractAddressFromPlaceString(
  raw: string,
  resolvedUrl: string,
): ResolvedAddress {
  // Split by comma segments
  const parts = raw.split(',').map((s) => s.trim());

  if (parts.length === 0) {
    return { address: null, placeName: null, resolvedUrl };
  }

  // Heuristic: if the first part starts with a number, the whole thing is an address
  const firstPart = parts[0];
  const startsWithNumber = /^\d/.test(firstPart);

  if (startsWithNumber) {
    // No place name — entire string is the address
    return {
      address: raw,
      placeName: null,
      resolvedUrl,
    };
  }

  // If there's only one part and it doesn't start with a number, it's a place name
  if (parts.length === 1) {
    return {
      address: null,
      placeName: firstPart,
      resolvedUrl,
    };
  }

  // Check if the second part starts with a number (street address)
  const secondPart = parts[1];
  if (/^\d/.test(secondPart)) {
    // First part is place name, rest is address
    return {
      address: parts.slice(1).join(', '),
      placeName: firstPart,
      resolvedUrl,
    };
  }

  // If neither part starts with a number, check if any part looks like a street address
  // (contains common street suffixes)
  const streetPattern = /\b(st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|way|pl|place|cir|circle|hwy|highway|trail|trl|pkwy|parkway)\b/i;

  for (let i = 0; i < parts.length; i++) {
    if (streetPattern.test(parts[i]) || /^\d/.test(parts[i])) {
      return {
        address: parts.slice(i).join(', '),
        placeName: parts.slice(0, i).join(', ') || null,
        resolvedUrl,
      };
    }
  }

  // Fallback: treat the whole thing as a place name if short, or address if long
  if (parts.length >= 3) {
    // Probably an address — "Some Area, City, State ZIP"
    return {
      address: raw,
      placeName: null,
      resolvedUrl,
    };
  }

  return {
    address: null,
    placeName: raw,
    resolvedUrl,
  };
}
