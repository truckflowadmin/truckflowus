/**
 * Parse incoming SMS messages into structured job data.
 *
 * Supports two modes:
 * 1. Structured format:  JOB Customer / From / To / Material / 10 loads
 * 2. Free-form text:     Uses Anthropic Claude API to extract fields
 *
 * If ANTHROPIC_API_KEY is not set, only structured parsing works.
 */

export interface ParsedJobSms {
  customer: string | null;
  hauledFrom: string | null;
  hauledTo: string | null;
  material: string | null;
  quantity: number | null;
  quantityType: 'LOADS' | 'TONS' | 'YARDS' | null;
  ratePerUnit: number | null;
  notes: string | null;
  /** Whether this was parsed via structured format or AI */
  parseMethod: 'structured' | 'ai' | 'failed';
  /** If parsing failed, a human-readable reason */
  error?: string;
}

const EMPTY: ParsedJobSms = {
  customer: null,
  hauledFrom: null,
  hauledTo: null,
  material: null,
  quantity: null,
  quantityType: null,
  ratePerUnit: null,
  notes: null,
  parseMethod: 'failed',
};

/**
 * Try structured parsing first, fall back to AI.
 *
 * Structured format (case-insensitive, "JOB" prefix):
 *   JOB Customer / From Location / To Location / Material / 10 loads
 *   JOB Customer / From / To / Material / 20 tons @ 15
 *
 * Separator: " / " (slash with spaces)
 * Quantity: "10 loads", "20 tons", "5 yards"
 * Optional rate: "@ 15" or "@15" after quantity
 */
export async function parseJobSms(text: string): Promise<ParsedJobSms> {
  const trimmed = text.trim();

  // Try structured parse first
  const structured = tryStructuredParse(trimmed);
  if (structured) return structured;

  // Fall back to AI
  return aiParse(trimmed);
}

/* ── Structured parser ──────────────────────────────────────── */

function tryStructuredParse(text: string): ParsedJobSms | null {
  // Must start with "JOB " (case-insensitive)
  if (!/^job\s/i.test(text)) return null;

  const body = text.replace(/^job\s+/i, '').trim();
  const parts = body.split(/\s*\/\s*/);

  // Need at least: customer / from / to
  if (parts.length < 3) return null;

  const customer = parts[0]?.trim() || null;
  const hauledFrom = parts[1]?.trim() || null;
  const hauledTo = parts[2]?.trim() || null;
  const material = parts.length >= 4 ? parts[3]?.trim() || null : null;

  let quantity: number | null = null;
  let quantityType: 'LOADS' | 'TONS' | 'YARDS' | null = null;
  let ratePerUnit: number | null = null;

  // Last part might contain quantity + optional rate
  const lastPart = parts[parts.length - 1]?.trim() || '';
  const qtyMatch = lastPart.match(/^(\d+)\s*(loads?|tons?|yards?)\s*(?:@\s*(\d+(?:\.\d+)?))?$/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1]);
    const unitRaw = qtyMatch[2].toLowerCase().replace(/s$/, '');
    quantityType = unitRaw === 'load' ? 'LOADS' : unitRaw === 'ton' ? 'TONS' : 'YARDS';
    if (qtyMatch[3]) ratePerUnit = parseFloat(qtyMatch[3]);
  }

  // If the quantity was embedded in the material slot, clear material
  const materialFinal = material === lastPart && qtyMatch ? null : material;

  return {
    customer,
    hauledFrom,
    hauledTo,
    material: materialFinal,
    quantity,
    quantityType,
    ratePerUnit,
    notes: null,
    parseMethod: 'structured',
  };
}

/* ── AI parser ──────────────────────────────────────────────── */

const AI_PROMPT = `You are an SMS parser for a trucking/hauling dispatch platform.
A broker has texted a job request. Extract the following fields from the message.
If a field is not mentioned, return null.

Messages may be in English or Spanish. Common patterns:
- "Desde" or "De" = From, "Hacia" or "Para" or "A" = To
- "PAY 130 a load" means ratePerUnit=130, quantityType=LOADS
- A standalone name at the start is usually the customer/job name
- Standalone material words: Fill, Dirt, Gravel, Sand, Rock, Shell, Base, Limerock

Return ONLY valid JSON (no markdown fences, no explanation) in this exact shape:
{
  "customer": "string or null — the customer, job name, or project name",
  "hauledFrom": "string or null — pickup/origin location (include full address if given)",
  "hauledTo": "string or null — delivery/destination location (include full address if given)",
  "material": "string or null — material being hauled",
  "quantity": "number or null — how many loads/tons/yards",
  "quantityType": "LOADS or TONS or YARDS or null",
  "ratePerUnit": "number or null — price per load/ton/yard if mentioned",
  "notes": "string or null — any other relevant info from the message"
}`;

const MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
];

async function aiParse(text: string): Promise<ParsedJobSms> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[sms-job-parser] No ANTHROPIC_API_KEY — cannot AI-parse SMS');
    return { ...EMPTY, error: 'No ANTHROPIC_API_KEY configured' };
  }

  let lastError = '';

  for (const model of MODELS) {
    try {
      console.log(`[sms-job-parser] Trying model: ${model}`);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: AI_PROMPT },
                { type: 'text', text: `SMS from broker:\n"${text}"` },
              ],
            },
          ],
        }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        console.error(`[sms-job-parser] API error ${model}: ${res.status}`, responseText.substring(0, 300));
        lastError = `API ${res.status}`;
        if (res.status === 404 || res.status === 400) continue;
        return { ...EMPTY, error: lastError };
      }

      let body: any;
      try {
        body = JSON.parse(responseText);
      } catch {
        return { ...EMPTY, error: 'API returned invalid JSON' };
      }

      const aiText: string = body.content?.[0]?.text ?? '';
      if (!aiText) return { ...EMPTY, error: 'AI returned empty response' };

      const jsonStr = aiText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return { ...EMPTY, error: 'AI response was not valid JSON', notes: aiText };
      }

      // Normalize quantityType
      let qt: 'LOADS' | 'TONS' | 'YARDS' | null = null;
      if (parsed.quantityType) {
        const raw = String(parsed.quantityType).toUpperCase();
        if (raw === 'LOADS' || raw === 'TONS' || raw === 'YARDS') qt = raw;
      }

      console.log('[sms-job-parser] AI extracted:', JSON.stringify(parsed));

      return {
        customer: parsed.customer ?? null,
        hauledFrom: parsed.hauledFrom ?? null,
        hauledTo: parsed.hauledTo ?? null,
        material: parsed.material ?? null,
        quantity: parsed.quantity != null ? Number(parsed.quantity) : null,
        quantityType: qt,
        ratePerUnit: parsed.ratePerUnit != null ? Number(parsed.ratePerUnit) : null,
        notes: parsed.notes ?? null,
        parseMethod: 'ai',
      };
    } catch (err: any) {
      console.error(`[sms-job-parser] Error with ${model}:`, err.message);
      lastError = err.message;
      continue;
    }
  }

  return { ...EMPTY, error: `All models failed: ${lastError}` };
}
