export interface ScorableQuote {
  id: string;
  vendor_name: string;
  vendor_email: string;
  total_amount: number | null;
  delivery_days: number | null;
  payment_terms: string | null;
  warranty: string | null;
  confidence: number | null;
  status: string;
  vendor_wins?: number | null;
  vendor_auctions?: number | null;
}

export interface Weights {
  price: number;
  delivery: number;
  quality: number;
}

export interface ScoredQuote extends ScorableQuote {
  price_score: number;
  delivery_score: number;
  quality_score: number;
  total_score: number;
  rank: number;
  is_cheapest: boolean;
  is_fastest: boolean;
  savings_vs_highest: number;
}

export const DEFAULT_WEIGHTS: Weights = { price: 50, delivery: 30, quality: 20 };

function normaliseLowerIsBetter(value: number | null, values: number[]): number {
  if (value === null || values.length === 0) return 0.5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return (max - value) / (max - min);
}

function qualityOf(quote: ScorableQuote): number {
  let score = 0.5;

  const auctions = quote.vendor_auctions ?? 0;
  const wins = quote.vendor_wins ?? 0;
  if (auctions > 0) score = Math.min(wins / auctions, 1);

  if (quote.warranty) score += 0.15;
  if (quote.payment_terms) score += 0.1;
  if ((quote.confidence ?? 1) < 0.5) score -= 0.25;

  return Math.max(0, Math.min(score, 1));
}

export function scoreQuotes(quotes: ScorableQuote[], weights: Weights): ScoredQuote[] {
  if (quotes.length === 0) return [];

  const prices = quotes.map((q) => q.total_amount).filter((v): v is number => v !== null);
  const deliveries = quotes.map((q) => q.delivery_days).filter((v): v is number => v !== null);

  const cheapest = prices.length ? Math.min(...prices) : null;
  const fastest = deliveries.length ? Math.min(...deliveries) : null;
  const dearest = prices.length ? Math.max(...prices) : null;

  const total = weights.price + weights.delivery + weights.quality || 1;

  const scored = quotes.map((q) => {
    const price_score = normaliseLowerIsBetter(q.total_amount, prices);
    const delivery_score = normaliseLowerIsBetter(q.delivery_days, deliveries);
    const quality_score = qualityOf(q);

    const total_score =
      (price_score * weights.price + delivery_score * weights.delivery + quality_score * weights.quality) / total;

    return {
      ...q,
      price_score,
      delivery_score,
      quality_score,
      total_score,
      rank: 0,
      is_cheapest: q.total_amount !== null && q.total_amount === cheapest,
      is_fastest: q.delivery_days !== null && q.delivery_days === fastest,
      savings_vs_highest: dearest !== null && q.total_amount !== null ? dearest - q.total_amount : 0,
    };
  });

  scored.sort((a, b) => b.total_score - a.total_score);
  scored.forEach((q, i) => { q.rank = i + 1; });

  return scored;
}

export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Not quoted';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function toTwoDp(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function formatInrShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Not quoted';
  if (!Number.isFinite(amount)) return 'Not quoted';
  if (amount >= 10000000) return '₹' + toTwoDp(amount / 10000000) + ' Cr';
  if (amount >= 100000) return '₹' + toTwoDp(amount / 100000) + ' L';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function describeTradeoff(winner: ScoredQuote, all: ScoredQuote[]): string {
  const cheapest = all.find((q) => q.is_cheapest);
  const fastest = all.find((q) => q.is_fastest);

  if (all.length === 1) return 'Only one quote received.';

  if (winner.is_cheapest && winner.is_fastest) {
    return 'Cheapest and fastest. No trade-off to make.';
  }

  const parts: string[] = [];

  if (!winner.is_cheapest && cheapest && winner.total_amount !== null && cheapest.total_amount !== null) {
    const extra = winner.total_amount - cheapest.total_amount;
    const pct = ((extra / cheapest.total_amount) * 100).toFixed(1);
    parts.push(`${formatInr(extra)} (${pct}%) dearer than ${cheapest.vendor_name}`);
  }

  if (winner.is_fastest && fastest && winner.delivery_days !== null) {
    const slowest = Math.max(...all.map((q) => q.delivery_days ?? 0));
    if (slowest > winner.delivery_days) {
      parts.push(`arrives ${slowest - winner.delivery_days} days sooner than the slowest`);
    }
  } else if (!winner.is_fastest && fastest && winner.delivery_days !== null && fastest.delivery_days !== null) {
    parts.push(`${winner.delivery_days - fastest.delivery_days} days slower than ${fastest.vendor_name}`);
  }

  if (winner.is_cheapest) parts.unshift('Lowest price');

  return parts.length ? parts.join(', ') + '.' : 'Best overall on the current weights.';
}
