const MODEL = process.env.QUOTE_PARSER_MODEL || 'gemini-3.5-flash';

export interface NegotiationInput {
  rfp_number: string;
  rfp_title: string;
  buyer_company: string;
  buyer_contact: string;
  vendor_name: string;
  current_amount: number;
  current_delivery: number | null;
  current_terms: string | null;
  best_rival_amount: number | null;
  best_rival_delivery: number | null;
  rival_count: number;
  target_amount: number;
  angle: string;
}

export interface NegotiationDraft {
  subject: string;
  body: string;
  leverage: string;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    subject: { type: 'STRING' },
    body: { type: 'STRING' },
    leverage: { type: 'STRING' },
  },
  required: ['subject', 'body', 'leverage'],
};

const INSTRUCTIONS = `You write counter-offer emails for an Indian procurement team negotiating with a supplier.

Rules:
- Write as the buyer, addressed to the supplier. Plain text, no markdown, no placeholders in square brackets.
- Open by thanking them for the quotation and naming the RFP number.
- State the ask plainly and give one concrete reason. Never invent a competing vendor's name, and never quote a rival's exact figure. Refer to competing offers only in general terms, such as "we have received a lower offer on comparable specification".
- Keep it under 160 words. Indian business email register: courteous, direct, no filler.
- Break the body into short paragraphs separated by a blank line: greeting, the ask
  with its reason, what you offer in return, the deadline, then the sign-off.
  Use real newline characters. Never return the whole email as one paragraph.
- Offer something in return where it is natural, such as faster payment or a firm order commitment.
- Close with a clear deadline for their revised offer and the buyer's name and company.
- Amounts in rupees written the Indian way, for example Rs. 23,80,000.
- leverage is a one-line internal note explaining the negotiating position. It is never shown to the supplier.`;

export async function draftNegotiation(input: NegotiationInput): Promise<NegotiationDraft | null> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY is not set');

  const facts = [
    `RFP: ${input.rfp_number} - ${input.rfp_title}`,
    `Buyer: ${input.buyer_contact} at ${input.buyer_company}`,
    `Supplier: ${input.vendor_name}`,
    `Their quote: Rs. ${input.current_amount.toLocaleString('en-IN')}`,
    input.current_delivery !== null ? `Their delivery: ${input.current_delivery} days` : null,
    input.current_terms ? `Their payment terms: ${input.current_terms}` : null,
    `Competing quotes received: ${input.rival_count}`,
    input.best_rival_amount !== null ? `Best competing price: Rs. ${input.best_rival_amount.toLocaleString('en-IN')} (do not reveal this figure)` : null,
    input.best_rival_delivery !== null ? `Best competing delivery: ${input.best_rival_delivery} days` : null,
    `Target price to ask for: Rs. ${input.target_amount.toLocaleString('en-IN')}`,
    `Angle to take: ${input.angle}`,
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
          contents: [{ role: 'user', parts: [{ text: `Write the counter-offer email.\n\n${facts}` }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    const json = await res.json();
    if (json.error) {
      console.error('[NEGOTIATION] Gemini error:', json.error.status, json.error.message);
      return null;
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text) as NegotiationDraft;
  } catch (err: any) {
    console.error('[NEGOTIATION] Draft failed:', err.name === 'AbortError' ? 'timed out' : err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function pickTarget(current: number, bestRival: number | null): { target: number; angle: string } {
  if (bestRival !== null && bestRival < current) {
    return {
      target: bestRival,
      angle: `A competing supplier has quoted lower on comparable specification. Ask them to match Rs. ${bestRival.toLocaleString('en-IN')}.`,
    };
  }

  const target = Math.round((current * 0.92) / 1000) * 1000;
  return {
    target,
    angle: 'They are already the most competitive offer. Ask for a volume discount of around 8 percent in exchange for a firm order and prompt payment.',
  };
}
