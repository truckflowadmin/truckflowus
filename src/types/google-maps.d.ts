/**
 * Minimal type declarations for Google Maps Places Autocomplete.
 * Avoids pulling in the full @types/google.maps package.
 */

declare namespace google.maps {
  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
      addListener(event: string, handler: () => void): void;
      getPlace(): PlaceResult;
    }

    interface AutocompleteOptions {
      types?: string[];
      fields?: string[];
      componentRestrictions?: { country: string | string[] };
    }

    interface PlaceResult {
      formatted_address?: string;
      name?: string;
      geometry?: {
        location: {
          lat(): number;
          lng(): number;
        };
      };
    }
  }
}
