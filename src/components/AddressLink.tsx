'use client';

/**
 * Renders an address string as a clickable OpenStreetMap link.
 *
 * Supports three input formats:
 *   1. Full Maps URL (Google or OSM) → renders as-is link
 *   2. Lat,Lng coordinates → builds an OSM link from coords
 *   3. Plain text address → builds an OSM search link
 *
 * Falls back to plain text when value is empty/null.
 */

interface AddressLinkProps {
  value: string | null | undefined;
  className?: string;
  /** Label shown before the icon — only used when rendering as link */
  label?: string;
}

// Match numeric coordinates like "30.2672,-97.7431" or "30.2672, -97.7431"
const COORD_RE = /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/;

// Match Google Maps URLs (still support opening them)
const MAPS_URL_RE = /^https?:\/\/(www\.)?(google\.\w+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps|openstreetmap\.org)/i;

function buildMapsUrl(value: string): string {
  const trimmed = value.trim();

  // Already a Maps link (Google or OSM) — open as-is
  if (MAPS_URL_RE.test(trimmed)) return trimmed;

  // Coordinates → OpenStreetMap
  if (COORD_RE.test(trimmed)) {
    const [lat, lng] = trimmed.split(',').map((s) => s.trim());
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  }

  // Plain address → OpenStreetMap search
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(trimmed)}`;
}

export default function AddressLink({ value, className, label }: AddressLinkProps) {
  if (!value || !value.trim()) return null;

  const url = buildMapsUrl(value);
  const isCoords = COORD_RE.test(value.trim());
  const isUrl = MAPS_URL_RE.test(value.trim());

  // Display text: show coords or truncated address, not the raw URL
  const displayText = isUrl
    ? 'View on Map'
    : isCoords
      ? value.trim()
      : value.trim();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? 'text-xs text-blue-500 hover:text-blue-400 hover:underline inline-flex items-center gap-1'}
      title={`Open in OpenStreetMap: ${value.trim()}`}
    >
      {/* Maps pin icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-3.5 h-3.5 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.181-.1.425-.24.709-.42.567-.36 1.302-.872 2.01-1.526C14.916 15.353 16.5 13.07 16.5 10a6.5 6.5 0 00-13 0c0 3.07 1.584 5.353 3.166 6.831a14.678 14.678 0 002.01 1.526 8.583 8.583 0 00.709.42 5.88 5.88 0 00.281.145l.018.008.006.003zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
      {label && <span>{label}: </span>}
      <span className="truncate max-w-[220px]">{displayText}</span>
    </a>
  );
}
