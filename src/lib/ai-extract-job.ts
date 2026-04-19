/**
 * AI-powered job document extraction.
 *
 * Sends a photo of a work order, dispatch sheet, broker email, or any
 * job-related document to Claude Vision and extracts structured job fields.
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */

export interface ExtractedJobData {
  customerName: string | null;
  hauledFromName: string | null;
  hauledFromAddress: string | null;
  hauledFromMapUrl: string | null;
  hauledToName: string | null;
  hauledToAddress: string | null;
  hauledToMapUrl: string | null;
  material: string | null;
  quantity: number | null;
  quantityType: 'LOADS' | 'TONS' | 'YARDS' | null;
  ratePerUnit: number | null;
  date: string | null;
  notes: string | null;
  brokerName: string | null;
  truckNumber: string | null;
  truckNumbers: string[] | null; // multiple truck numbers if listed
  driverName: string | null;
  rawText: string | null;
  _error?: string;
}

const EMPTY: ExtractedJobData = {
  customerName: null, hauledFromName: null, hauledFromAddress: null, hauledFromMapUrl: null,
  hauledToName: null, hauledToAddress: null, hauledToMapUrl: null, material: null,
  quantity: null, quantityType: null, ratePerUnit: null, date: null,
  notes: null, brokerName: null, truckNumber: null, truckNumbers: null, driverName: null,
  rawText: null,
};

const JOB_EXTRACTION_PROMPT = `You are an OCR/document-reading assistant for a dump-truck dispatch platform.
The user will show you a photo of a job-related document. This could be:
- A work order or dispatch sheet
- A broker's job request (printed email, text message screenshot, fax)
- A handwritten note with job details
- A load ticket or delivery order

Extract ALL of the following fields if they are present. If a field is not found, return null.
Be precise — copy names, addresses, and numbers exactly as written.

IMPORTANT layout pattern: Often the document has a simple top-to-bottom layout like:
  Name (customer/job name — usually the first line or standalone name at the top)
  From/Desde: address
  Material (standalone word like "Fill", "Gravel", "Sand", etc.)
  To: address
  PAY amount a load/ton/yard

Look for common label variations (English AND Spanish):
- Customer: "customer", "buyer", "sold to", "bill to", "project", "job name", "site", or a standalone name at the top of the document
- Hauled From: "origin", "pit", "plant", "loaded at", "pickup", "from", "desde", "source", "quarry", "de"
- Hauled To: "destination", "deliver to", "ship to", "drop", "site", "to", "hacia", "para", "a"
- Material: "product", "material", "description", "type", "aggregate", or a standalone word like "Fill", "Dirt", "Gravel", "Sand", "Rock", "Shell", "Base", "Limerock"
- Quantity: "loads", "tons", "yards", "qty", "amount", "count", "cargas"
- Rate: "rate", "price", "per load", "per ton", "per yard", "$/load", "PAY X a load", "PAY X a ton", "pago"

For the rate field: "PAY 130 a load" means ratePerUnit=130 and quantityType=LOADS.

IMPORTANT — For hauledFrom and hauledTo, SEPARATE the location name from the street address:
- "hauledFromName" = the place/business/site name (e.g. "Jetport Motor Suites", "Smith Quarry"). If there is NO name — only a street address — return null. Do NOT put the street address here.
- "hauledFromAddress" = the full street address with city, state, zip (e.g. "3106 Horseshoe Dr N, Naples, FL 34104")
Same logic applies for hauledTo.

Example: "To: Jetport Motor Suites, 3106 Horseshoe Dr N, Naples, FL 34104"
→ hauledToName = "Jetport Motor Suites", hauledToAddress = "3106 Horseshoe Dr N, Naples, FL 34104"

Example: "Desde: 10481 Packinghouse Ln, Bonita Springs, FL 34135"
→ hauledFromName = null (no business name, just a street address), hauledFromAddress = "10481 Packinghouse Ln, Bonita Springs, FL 34135"

IMPORTANT — Google Maps URLs: Documents often contain Google Maps links (e.g. https://maps.app.goo.gl/xxxxx or https://goo.gl/maps/xxxxx) next to addresses.
- If a Maps link appears near the "From/Desde" location, put it in "hauledFromMapUrl"
- If a Maps link appears near the "To" location, put it in "hauledToMapUrl"
- Capture the FULL URL exactly as shown, including any query parameters

Return ONLY valid JSON (no markdown fences, no explanation) in this exact shape:
{
  "customerName": "string or null — customer, project, or job name",
  "hauledFromName": "string or null — pickup location name/business (null if only an address)",
  "hauledFromAddress": "string or null — pickup street address with city, state, zip",
  "hauledFromMapUrl": "string or null — Google Maps URL associated with the pickup location",
  "hauledToName": "string or null — delivery location name/business (null if only an address)",
  "hauledToAddress": "string or null — delivery street address with city, state, zip",
  "hauledToMapUrl": "string or null — Google Maps URL associated with the delivery location",
  "material": "string or null — material being hauled",
  "quantity": "number or null — how many loads/tons/yards requested",
  "quantityType": "LOADS or TONS or YARDS or null — unit type",
  "ratePerUnit": "number or null — price per load/ton/yard",
  "date": "string or null — job date formatted as YYYY-MM-DD",
  "notes": "string or null — special instructions, access info, anything else relevant",
  "brokerName": "string or null — broker or dispatcher company name if visible",
  "truckNumber": "string or null — single truck/vehicle number if only one is specified",
  "truckNumbers": "array of strings or null — ALL truck/vehicle numbers listed on the document (e.g. ['T-101', 'T-102', 'T-103']). Use this when multiple trucks are mentioned.",
  "driverName": "string or null — driver name if specified",
  "rawText": "string — all readable text on the document, newline-separated"
}`;

const MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
];

export async function extractJobData(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<ExtractedJobData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[ai-extract-job] No ANTHROPIC_API_KEY set — skipping extraction');
    return { ...EMPTY, _error: 'No ANTHROPIC_API_KEY configured' };
  }

  console.log('[ai-extract-job] Starting extraction, image size:', Math.round(base64Image.length / 1024), 'KB');

  let lastError = '';

  for (const model of MODELS) {
    try {
      console.log(`[ai-extract-job] Trying model: ${model}`);

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
                  source: { type: 'base64', media_type: mimeType, data: base64Image },
                },
                { type: 'text', text: JOB_EXTRACTION_PROMPT },
              ],
            },
          ],
        }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        console.error(`[ai-extract-job] API error ${model}: ${res.status}`, responseText.substring(0, 500));
        lastError = `API ${res.status}: ${responseText.substring(0, 200)}`;
        if (res.status === 404 || res.status === 400) continue;
        return { ...EMPTY, _error: lastError };
      }

      let body: any;
      try {
        body = JSON.parse(responseText);
      } catch {
        return { ...EMPTY, _error: 'API returned invalid JSON' };
      }

      const text: string = body.content?.[0]?.text ?? '';
      if (!text) return { ...EMPTY, _error: 'AI returned empty response' };

      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return { ...EMPTY, rawText: text, _error: 'AI response was not valid JSON' };
      }

      // Normalize quantityType
      let qt: 'LOADS' | 'TONS' | 'YARDS' | null = null;
      if (parsed.quantityType) {
        const raw = String(parsed.quantityType).toUpperCase();
        if (raw === 'LOADS' || raw === 'TONS' || raw === 'YARDS') qt = raw;
      }

      console.log('[ai-extract-job] Extracted:', Object.keys(parsed).filter(k => parsed[k] !== null).join(', '));

      return {
        customerName: parsed.customerName ?? null,
        hauledFromName: parsed.hauledFromName ?? null,
        hauledFromAddress: parsed.hauledFromAddress ?? null,
        hauledFromMapUrl: parsed.hauledFromMapUrl ?? null,
        hauledToName: parsed.hauledToName ?? null,
        hauledToAddress: parsed.hauledToAddress ?? null,
        hauledToMapUrl: parsed.hauledToMapUrl ?? null,
        material: parsed.material ?? null,
        quantity: parsed.quantity != null ? Number(parsed.quantity) : null,
        quantityType: qt,
        ratePerUnit: parsed.ratePerUnit != null ? Number(parsed.ratePerUnit) : null,
        date: parsed.date ?? null,
        notes: parsed.notes ?? null,
        brokerName: parsed.brokerName ?? null,
        truckNumber: parsed.truckNumber ?? null,
        truckNumbers: Array.isArray(parsed.truckNumbers) ? parsed.truckNumbers.map(String) : null,
        driverName: parsed.driverName ?? null,
        rawText: parsed.rawText ?? null,
      };
    } catch (err: any) {
      console.error(`[ai-extract-job] Error with ${model}:`, err.message);
      lastError = err.message;
      continue;
    }
  }

  return { ...EMPTY, _error: `All models failed: ${lastError}` };
}
