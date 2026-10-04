const PARSER_MODEL = process.env.QUOTE_PARSER_MODEL || 'gemini-3.5-flash';

export interface ParsedQuote {
  is_quote: boolean;
  vendor_name: string | null;
  total_amount: number | null;
  currency: string;
  delivery_days: number | null;
  payment_terms: string | null;
  warranty: string | null;
  line_items: Array<{
    description: string;
    quantity: number | null;
    unit_price: number | null;
    amount: number | null;
  }>;
  notes: string | null;
  confidence: number;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_quote: { type: 'BOOLEAN' },
    vendor_name: { type: 'STRING', nullable: true },
    total_amount: { type: 'NUMBER', nullable: true },
    currency: { type: 'STRING' },
    delivery_days: { type: 'INTEGER', nullable: true },
    payment_terms: { type: 'STRING', nullable: true },
    warranty: { type: 'STRING', nullable: true },
    line_items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          quantity: { type: 'NUMBER', nullable: true },
          unit_price: { type: 'NUMBER', nullable: true },
          amount: { type: 'NUMBER', nullable: true },
        },
        required: ['description'],
      },
    },
    notes: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
  },
  required: ['is_quote', 'currency', 'line_items', 'confidence'],
};

const INSTRUCTIONS = `You extract structured pricing data from vendor quotations sent to a procurement team in India.

Rules:
- is_quote is false when the document contains no pricing at all. Set it false for acknowledgements, out-of-office replies, questions and marketing mail.
- total_amount is the final payable figure. If the document shows a subtotal and a grand total including GST, use the grand total.
- Amounts are plain numbers. Strip currency symbols, commas and Indian digit grouping. "Rs. 12,45,000" becomes 1245000.
- currency is a 3-letter code. Default to INR when the document shows Rs, INR or the rupee sign.
- delivery_days is a whole number of days. Convert weeks and months. "4 weeks" becomes 28. Use null when no timeline is stated.
- payment_terms is a short phrase copied from the document, such as "50% advance, 50% on delivery" or "Net 30".
- confidence is between 0 and 1 and reports how certain you are the extracted total is correct. Use below 0.5 when the document is unclear, scanned badly, or the total had to be inferred.
- Never invent a figure. Use null when something is absent.`;

async function callGemini(parts: any[]): Promise<ParsedQuote | null> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${PARSER_MODEL}:generateContent?key=${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (err: any) {
    console.error('[QUOTE PARSER] Request failed:', err.name === 'AbortError' ? 'timed out after 25s' : err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json();

  if (json.error) {
    console.error('[QUOTE PARSER] Gemini error:', json.error.status, json.error.message);
    return null;
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('[QUOTE PARSER] Empty response from model');
    return null;
  }

  try {
    const parsed = JSON.parse(text) as ParsedQuote;
    if (!Array.isArray(parsed.line_items)) parsed.line_items = [];
    if (typeof parsed.confidence !== 'number') parsed.confidence = 0;
    if (!parsed.currency) parsed.currency = 'INR';
    return parsed;
  } catch (err) {
    console.error('[QUOTE PARSER] Could not parse model JSON:', text.slice(0, 200));
    return null;
  }
}

export async function parseQuoteFromPdf(
  base64: string,
  mimeType: string,
  context: string
): Promise<ParsedQuote | null> {
  return callGemini([
    { text: `Extract the quotation from this document.\n\nContext: ${context}` },
    { inline_data: { mime_type: mimeType, data: base64 } },
  ]);
}

export async function parseQuoteFromText(
  text: string,
  context: string
): Promise<ParsedQuote | null> {
  if (!text || text.trim().length < 20) return null;
  return callGemini([
    { text: `Extract the quotation from this email.\n\nContext: ${context}\n\nEmail body:\n${text}` },
  ]);
}

export function extractRfpNumber(...sources: string[]): string | null {
  for (const source of sources) {
    if (!source) continue;
    const match = source.match(/RFP[\s-]?(\d{3,6})/i);
    if (match) return `RFP-${match[1].padStart(4, '0')}`;
  }
  return null;
}

export const PARSEABLE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export function isParseableAttachment(mimeType: string, filename: string): boolean {
  if (PARSEABLE_MIME_TYPES.includes(mimeType)) return true;
  return /\.(pdf|png|jpe?g|webp)$/i.test(filename);
}
