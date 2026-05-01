'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Address autocomplete input using OpenStreetMap Nominatim (free, no API key).
 *
 * Debounces keystrokes by 400ms, queries Nominatim, and shows a dropdown
 * of suggestions. Falls back to a plain text input if fetch fails.
 */

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

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
  placeholder = 'Address, coordinates, or location',
  className = 'input mt-1.5',
  required,
  onPlaceSelect,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync externalValue (e.g. from scan) into the input
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== inputValue) {
      setInputValue(externalValue);
      if (inputRef.current) inputRef.current.value = externalValue;
    }
  }, [externalValue]);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=us`,
        {
          headers: {
            'Accept': 'application/json',
            // Nominatim requires a User-Agent to identify the app
            'User-Agent': 'TruckFlowUS/1.0',
          },
        }
      );
      if (!res.ok) return;
      const results: NominatimResult[] = await res.json();
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(val), 400);
  }, [searchAddress]);

  const selectSuggestion = useCallback((result: NominatimResult) => {
    const formatted = result.display_name;
    setInputValue(formatted);
    setSuggestions([]);
    setShowDropdown(false);

    if (inputRef.current) {
      inputRef.current.value = formatted;
      // Fire native input event so React / form data picks it up
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(inputRef.current, formatted);
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (onPlaceSelect) {
      onPlaceSelect(formatted, parseFloat(result.lat), parseFloat(result.lon));
    }
  }, [onPlaceSelect]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
      />
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white border border-steel-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((result, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectSuggestion(result)}
              className="w-full text-left px-3 py-2 text-sm text-steel-800 hover:bg-steel-50 border-b border-steel-50 last:border-b-0 transition-colors"
            >
              <span className="text-steel-400 mr-1.5">📍</span>
              {result.display_name}
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-steel-300 text-right">
            © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  );
}
