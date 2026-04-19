'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Google Places Autocomplete input for address fields.
 *
 * Loads the Google Maps JS API once (idempotent) and attaches Places
 * Autocomplete to the input. When a place is selected the full formatted
 * address is written into the input's value (and fires onChange).
 *
 * Falls back to a plain text input when the API key is missing or invalid.
 *
 * Set NEXT_PUBLIC_GOOGLE_MAPS_ENABLED="true" to activate autocomplete.
 * Without it, the component renders a normal text input (safe default).
 */

// ---------------------------------------------------------------------------
// Script loader — shared across all instances
// ---------------------------------------------------------------------------
let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));

  // Opt-in flag — must be explicitly enabled
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED !== 'true') {
    return Promise.reject(new Error('Google Maps not enabled'));
  }

  if ((window as any).google?.maps?.places) return Promise.resolve();

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!key) {
        reject(new Error('No API key'));
        return;
      }

      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Script failed')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface AddressAutocompleteProps {
  name: string;
  defaultValue?: string;
  /** Controlled value — when set externally (e.g. by scan), updates the input */
  externalValue?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  /** Called when a place is selected from the dropdown */
  onPlaceSelect?: (formatted: string, lat: number, lng: number) => void;
}

export default function AddressAutocomplete({
  name,
  defaultValue = '',
  externalValue,
  placeholder = 'Address, coordinates, or Maps link',
  className = 'input mt-1.5',
  required,
  onPlaceSelect,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handlePlaceChanged = useCallback(() => {
    const ac = autocompleteRef.current;
    if (!ac || !inputRef.current) return;

    const place = ac.getPlace();
    if (!place?.formatted_address && !place?.name) return;

    const formatted = place.formatted_address || place.name || '';
    inputRef.current.value = formatted;

    // Fire native input event so React / form data picks it up
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(inputRef.current, formatted);
    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));

    if (onPlaceSelect && place.geometry?.location) {
      onPlaceSelect(
        formatted,
        place.geometry.location.lat(),
        place.geometry.location.lng(),
      );
    }
  }, [onPlaceSelect]);

  // Sync externalValue (e.g. from scan) into the uncontrolled input
  useEffect(() => {
    if (externalValue !== undefined && inputRef.current && inputRef.current.value !== externalValue) {
      inputRef.current.value = externalValue;
    }
  }, [externalValue]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        if (autocompleteRef.current) return;

        try {
          const ac = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['geocode', 'establishment'],
            fields: ['formatted_address', 'name', 'geometry'],
          });
          ac.addListener('place_changed', handlePlaceChanged);
          autocompleteRef.current = ac;
        } catch {
          console.warn('[AddressAutocomplete] Places API init failed, using plain input');
        }
      })
      .catch(() => {
        // Not enabled, no API key, or script failed — plain text input
      });

    return () => {
      cancelled = true;
    };
  }, [handlePlaceChanged]);

  return (
    <input
      ref={inputRef}
      type="text"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={className}
      required={required}
      autoComplete="off"
    />
  );
}
