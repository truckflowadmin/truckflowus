/**
 * AI-powered ticket photo extraction.
 *
 * Sends a photo to the Anthropic Claude API (vision) and extracts structured
 * data fields from a physical dump-truck ticket.
 *
 * Requires ANTHROPIC_API_KEY in the environment. If the key isn't set the
 * extraction returns null fields so the system degrades to "photo only" mode
 * and the dispatcher can read the image manually.
 */

export interface ExtractedTicketData {
  tons: string | null;
  yards: string | null;
  ticketNumber: string | null;
  date: string | null;
  rawText: string | null;
  hauledFrom: string | null;
  hauledTo: string | null;
  material: string | null;
  customerName: string | null;
  driverName: string | null;
  truckNumber: string | null;
  grossWeight: string | null;
  tareWeight: string | null;
  netWeight: string | null;
  orderNumber: string | null;
  notes: string | null;
  /** If extraction failed, this contains a human-readable reason */
  _error?: string;
}

const EMPTY_RESULT: ExtractedTicketData = {
  tons: null, yards: null, ticketNumber: null, date: null, rawText: null,
  hauledFrom: null, hauledTo: null, material: null, customerName: null,
  driverName: null, truckNumber: null, grossWeight: null, tareWeight: null,
  netWeight: null, orderNumber: null, notes: null,
};

const EXTRACTION_PROMPT = `You are an OCR assistant for a dump-truck dispatch platform.
The user will show you a photo of a physical haul ticket or load ticket.

Extract ALL of the following fields if they are present on the ticket. If a field is
not found, return null for that field. Be precise — copy numbers and dates
exactly as printed. Look for common label variations (e.g. "Ship To" = hauledTo,
"Origin" / "Pit" / "Plant" / "Loaded at" = hauledFrom, "Product" / "Description" = material).

Return ONLY valid JSON (no markdown fences, no explanation) in this exact shape:
{
  "tons": "number or null — net tons if present",
  "yards": "number or null — cubic yards if present",
  "ticketNumber": "string or null — the ticket/receipt number",
  "date": "string or null — the date on the ticket, formatted as YYYY-MM-DD",
  "hauledFrom": "string or null — origin / plant / pit / loaded-at / ship-from location",
  "hauledTo": "string or null — destination / delivered-to / ship-to location",
  "material": "string or null — product / material description",
  "customerName": "string or null — customer / buyer / sold-to name",
  "driverName": "string or null — driver / hauler name",
  "truckNumber": "string or null — truck / vehicle number or license",
  "grossWeight": "string or null — gross weight value",
  "tareWeight": "string or null — tare weight value",
  "netWeight": "string or null — net weight value",
  "orderNumber": "string or null — PO / order / job number",
  "notes": "string or null — any other relevant remarks on the ticket",
  "rawText": "string — all readable text on the ticket, newline-separated"
}`;

/**
 * Lightweight prompt for job-context scans — only extract quantity + ticket number.
 * All other fields (hauledFrom, hauledTo, customer, driver, etc.) come from the job.
 */
const JOB_CONTEXT_PROMPT = `You are an OCR assistant for a dump-truck dispatch platform.
The user will show you a photo of a physical haul ticket or load ticket.

This ticket is being scanned in the context of a job where all details (origin, destination,
customer, driver, material, etc.) are already known. You ONLY need to extract the quantity
and ticket number from the image.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact shape:
{
  "tons": "number or null — net tons if present",
  "yards": "number or null — cubic yards if present",
  "ticketNumber": "string or null — the ticket/receipt number printed on the ticket",
  "grossWeight": "string or null — gross weight value",
  "tareWeight": "string or null — tare weight value",
  "netWeight": "string or null — net weight value",
  "rawText": "string — all readable text on the ticket, newline-separated"
}`;

/** Models to try in order — first success wins (cheapest vision-capable first) */
const MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
];

export async function extractTicketData(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<ExtractedTicketData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[ai-extract] No ANTHROPIC_API_KEY set — skipping AI extraction');
    return { ...EMPTY_RESULT, _error: 'No ANTHROPIC_API_KEY configured' };
  }

  console.log('[ai-extract] Starting extraction, image size:', Math.round(base64Image.length / 1024), 'KB, mime:', mimeType);

  let lastError = '';

  for (const model of MODELS) {
    try {
      console.log(`[ai-extract] Trying model: ${model}`);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: EXTRACTION_PROMPT,
                },
              ],
            },
          ],
        }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        console.error(`[ai-extract] API error with ${model}: ${res.status}`, responseText.substring(0, 500));
        lastError = `API ${res.status}: ${responseText.substring(0, 200)}`;

        // If it's a model-not-found error, try the next model
        if (res.status === 404 || res.status === 400) {
          continue;
        }
        // For auth errors or rate limits, don't retry other models
        return { ...EMPTY_RESULT, _error: lastError };
      }

      // Parse the API response
      let body: any;
      try {
        body = JSON.parse(responseText);
      } catch {
        console.error('[ai-extract] Failed to parse API response as JSON:', responseText.substring(0, 300));
        return { ...EMPTY_RESULT, _error: 'API returned invalid JSON' };
      }

      const text: string = body.content?.[0]?.text ?? '';
      console.log('[ai-extract] Raw AI response (first 500 chars):', text.substring(0, 500));

      if (!text) {
        console.error('[ai-extract] Empty text in API response. Full body:', JSON.stringify(body).substring(0, 500));
        return { ...EMPTY_RESULT, _error: 'AI returned empty response' };
      }

      // Parse the JSON from Claude's response — strip code fences if present
      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error('[ai-extract] Failed to parse extracted JSON:', jsonStr.substring(0, 500));
        return { ...EMPTY_RESULT, rawText: text, _error: 'AI response was not valid JSON' };
      }

      console.log('[ai-extract] Successfully extracted fields:', Object.keys(parsed).filter(k => parsed[k] !== null).join(', '));

      return {
        tons: parsed.tons ?? null,
        yards: parsed.yards ?? null,
        ticketNumber: parsed.ticketNumber ?? null,
        date: parsed.date ?? null,
        rawText: parsed.rawText ?? null,
        hauledFrom: parsed.hauledFrom ?? null,
        hauledTo: parsed.hauledTo ?? null,
        material: parsed.material ?? null,
        customerName: parsed.customerName ?? null,
        driverName: parsed.driverName ?? null,
        truckNumber: parsed.truckNumber ?? null,
        grossWeight: parsed.grossWeight ?? null,
        tareWeight: parsed.tareWeight ?? null,
        netWeight: parsed.netWeight ?? null,
        orderNumber: parsed.orderNumber ?? null,
        notes: parsed.notes ?? null,
      };
    } catch (err: any) {
      console.error(`[ai-extract] Network/runtime error with ${model}:`, err.message);
      lastError = err.message;
      continue;
    }
  }

  // All models failed
  console.error('[ai-extract] All models failed. Last error:', lastError);
  return { ...EMPTY_RESULT, _error: `Extraction failed: ${lastError}` };
}

/**
 * Lightweight extraction for job-context scans.
 * Only extracts quantity (tons/yards) and ticket number — everything else
 * is already known from the job. Uses a smaller prompt = faster + cheaper.
 */
export async function extractTicketDataLite(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<ExtractedTicketData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[ai-extract-lite] No ANTHROPIC_API_KEY set — skipping AI extraction');
    return { ...EMPTY_RESULT, _error: 'No ANTHROPIC_API_KEY configured' };
  }

  console.log('[ai-extract-lite] Starting lightweight extraction, image size:', Math.round(base64Image.length / 1024), 'KB');

  let lastError = '';

  for (const model of MODELS) {
    try {
      console.log(`[ai-extract-lite] Trying model: ${model}`);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: JOB_CONTEXT_PROMPT,
                },
              ],
            },
          ],
        }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        console.error(`[ai-extract-lite] API error with ${model}: ${res.status}`, responseText.substring(0, 500));
        lastError = `API ${res.status}: ${responseText.substring(0, 200)}`;
        if (res.status === 404 || res.status === 400) continue;
        return { ...EMPTY_RESULT, _error: lastError };
      }

      let body: any;
      try {
        body = JSON.parse(responseText);
      } catch {
        return { ...EMPTY_RESULT, _error: 'API returned invalid JSON' };
      }

      const text: string = body.content?.[0]?.text ?? '';
      if (!text) {
        return { ...EMPTY_RESULT, _error: 'AI returned empty response' };
      }

      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return { ...EMPTY_RESULT, rawText: text, _error: 'AI response was not valid JSON' };
      }

      console.log('[ai-extract-lite] Extracted:', Object.keys(parsed).filter(k => parsed[k] !== null).join(', '));

      return {
        ...EMPTY_RESULT,
        tons: parsed.tons ?? null,
        yards: parsed.yards ?? null,
        ticketNumber: parsed.ticketNumber ?? null,
        grossWeight: parsed.grossWeight ?? null,
        tareWeight: parsed.tareWeight ?? null,
        netWeight: parsed.netWeight ?? null,
        rawText: parsed.rawText ?? null,
      };
    } catch (err: any) {
      console.error(`[ai-extract-lite] Error with ${model}:`, err.message);
      lastError = err.message;
      continue;
    }
  }

  console.error('[ai-extract-lite] All models failed. Last error:', lastError);
  return { ...EMPTY_RESULT, _error: `Extraction failed: ${lastError}` };
}
