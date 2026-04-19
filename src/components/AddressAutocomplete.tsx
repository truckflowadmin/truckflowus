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
 */

// ---------------------------------------------------------------------------
// Script loader — shared across all instances
// ---------------------------------------------------------------------------
let loadPromise: Promise<void> | null = null;
let googleMapsAuthFailed = false;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  // If we already know the API key is bad, don't even try
  if (googleMapsAuthFailed) return Promise.reject(new Error('Auth failed'));

  if ((window as any).google?.maps?.places) return Promise.resolve();

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      // Bail out if no API key — component will work as a plain input
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!key) {
        reject(new Error('No API key'));
        return;
      }

      // Google calls this global function when the API key is invalid
      (window as any).gm_authFailure = () => {
        googleMapsAuthFailed = true;
        console.warn('[AddressAutocomplete] Google Maps API key error — falling back to plain input');
        // Remove Google's error overlays that block inputs
        document.querySelectorAll('.gm-err-container, .gm-err-autocomplete, .gm-style-pbc').forEach((el) => el.remove());
        reject(new Error('Auth failed'));
      };

      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existing) {
        // Script already added by another mount — wait for it
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Script failed')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Give Google a moment to check auth — if gm_authFailure fires, it'll reject
        setTimeout(() => {
          if (!googleMapsAuthFailed) resolve();
        }, 500);
      };
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
        if (autocompleteRef.current) return; // already attached

        try {
          const ac = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['geocode', 'establishment'],
            fields: ['formatted_address', 'name', 'geometry'],
          });
          ac.addListener('place_changed', handlePlaceChanged);
          autocompleteRef.current = ac;
        } catch {
          // Google Maps loaded but Places failed — input stays plain text
          console.warn('[AddressAutocomplete] Places API init failed, using plain input');
        }
      })
      .catch(() => {
        // No API key, auth failed, or script failed — remove any error overlays
        // Google injects .gm-err-container divs that block the page
        setTimeout(() => {
          document.querySelectorAll('.gm-err-container, .gm-err-autocomplete, .gm-style-pbc, [class*="gm-err"]').forEach((el) => el.remove());
        }, 100);
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
