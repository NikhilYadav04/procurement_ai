import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Trophy,
  Zap,
  IndianRupee,
  AlertTriangle,
  Check,
  RefreshCw,
  FileText,
  TrendingDown,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  scoreQuotes,
  describeTradeoff,
  DEFAULT_WEIGHTS,
  type Weights,
  type ScorableQuote,
} from '@/lib/quoteScoring';
import { formatINR, formatINRCompact, formatNumber, formatPercent } from '@/lib/format';
import { spring, enterItem, STAGGER } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Chip } from './ui/atmosphere';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface QuoteComparisonProps {
  rfpNumber: string;
  customerEmail: string;
  userId?: string;
  onAwarded?: (vendorName: string) => void;
}

/**
 * Quote amounts come back null when the agent could not parse one from the
 * supplier's reply. Never render a guess, and never render it as zero.
 */
const amountOrNull = (n: number | null) => (n !== null ? formatINR(n) : 'Not quoted');

/** Named grid columns shared by the ranked-list header and every row, so figures line up. */
const RANK_GRID =
  'grid grid-cols-[2rem_minmax(9rem,1fr)_7.5rem_5rem_minmax(7rem,9rem)_7rem_6rem] items-center gap-x-3';

export const QuoteComparison: React.FC<QuoteComparisonProps> = ({
  rfpNumber,
  customerEmail,
  userId,
  onAwarded,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [quotes, setQuotes] = useState<ScorableQuote[]>([]);
  const [superseded, setSuperseded] = useState<
    Array<{ id: string; vendor_name: string; total_amount: number; replaced_by: number | null }>
  >([]);
  const [rfpTitle, setRfpTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [awarding, setAwarding] = useState<string | null>(null);
  const [awardedTo, setAwardedTo] = useState<string | null>(null);
  const [po, setPo] = useState<{
    po_number: string;
    vendor_name: string;
    total_amount: number;
    savings_vs_highest: number;
    delivery_days: number | null;
    issued_at: string;
  } | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/quotes/list?rfpNumber=${encodeURIComponent(rfpNumber)}&customerEmail=${encodeURIComponent(customerEmail)}`
      );
      const data = await res.json();
      if (data.success) {
        setQuotes(data.quotes);
        setSuperseded(data.superseded || []);
        setRfpTitle(data.rfp_title || '');
        const awarded = data.quotes.find((q: ScorableQuote) => q.status === 'awarded');
        if (awarded) setAwardedTo(awarded.vendor_name);
        if (data.purchase_order) setPo(data.purchase_order);
      } else {
        setLoadError(data.error || 'Could not load quotes for this RFP.');
      }
    } catch {
      setLoadError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpNumber, customerEmail]);

  const scored = useMemo(() => scoreQuotes(quotes, weights), [quotes, weights]);
  const winner = scored[0];

  const wonByNegotiating = useMemo(
    () => superseded.filter((s) => s.replaced_by !== null && s.replaced_by < s.total_amount),
    [superseded]
  );

  const priceStats = useMemo(() => {
    const amounts = quotes.map((q) => q.total_amount).filter((v): v is number => v !== null);
    if (amounts.length === 0) return { lowest: null, spread: null };
    return { lowest: Math.min(...amounts), spread: Math.max(...amounts) - Math.min(...amounts) };
  }, [quotes]);

  const handleSync = async () => {
    if (!userId) {
      toast.error('Cannot check inbox', { description: 'No user session found.' });
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/quotes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, customerEmail }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.quotes_saved > 0
            ? `${data.quotes_saved} new quote${data.quotes_saved > 1 ? 's' : ''} found`
            : 'No new quotes'
        );
        await load();
      } else {
        toast.error('Could not check inbox', { description: data.error });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleAward = async (quoteId: string, vendorName: string) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Award this purchase order to ${vendorName}? This issues the purchase order and cannot be undone here.`
      );
      if (!confirmed) return;
    }
    setAwarding(quoteId);
    try {
      const res = await fetch('/api/quotes/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, customerEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setAwardedTo(vendorName);
        toast.success(`Awarded to ${vendorName}`, {
          description: data.po_number ? `Purchase order ${data.po_number} generated` : undefined,
        });
        await load();
        onAwarded?.(vendorName);
      } else {
        toast.error('Could not award', { description: data.error });
      }
    } finally {
      setAwarding(null);
    }
  };

  const weightRow = (label: string, key: keyof Weights, hint: string) => (
    <React.Fragment key={key}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Slider
        min={0}
        max={100}
        step={5}
        value={[weights[key]]}
        onValueChange={([v]) => setWeights((w) => ({ ...w, [key]: v }))}
        aria-label={`${label} weight`}
        title={hint}
        className="w-full"
      />
      <span className="text-right font-mono text-sm tabular-nums text-foreground">
        {weights[key]}%
      </span>
    </React.Fragment>
  );

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-background p-6" aria-live="polite" aria-busy="true">
        <div className="mx-auto max-w-4xl motion-safe:animate-pulse space-y-6">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-sunken" />
            <div className="h-6 w-64 rounded bg-sunken" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="panel h-16 p-4" />
            ))}
          </div>
          <div className="panel h-32 p-4" />
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel h-24 p-4" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center" role="alert">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-xs text-sm text-foreground">{loadError}</p>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="min-w-0">
            <p className="font-mono text-label tabular-nums text-muted-foreground">{rfpNumber}</p>
            <h2 className="mt-0.5 truncate text-xl font-semibold text-foreground [text-wrap:balance]">
              {rfpTitle || 'Quote comparison'}
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden="true" />
            {syncing ? 'Checking…' : 'Check inbox'}
          </Button>
        </div>

        {po && (
          <motion.div
            initial={shouldReduceMotion ? false : enterItem(0).initial}
            animate={enterItem(0).animate}
            transition={shouldReduceMotion ? { duration: 0 } : enterItem(0).transition}
            className="panel mt-5 border-primary/30 p-5"
            role="status"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-label text-muted-foreground">
                    Awarded &middot; <span className="font-mono tabular-nums">{po.po_number}</span>
                  </span>
                </div>
                <p className="text-base font-semibold text-foreground">
                  {po.vendor_name}, <span className="font-mono tabular-nums">{formatINR(po.total_amount)}</span>
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {po.savings_vs_highest > 0
                    ? `Saved ${formatINR(po.savings_vs_highest)} against the highest quote.`
                    : 'Purchase order issued.'}
                  {po.delivery_days !== null ? ` Delivery in ${formatNumber(po.delivery_days)} days.` : ''}
                </p>
              </div>
              <a
                href={`/api/po/${encodeURIComponent(po.po_number)}?customerEmail=${encodeURIComponent(customerEmail)}`}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-inner)] bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Open {po.po_number}
              </a>
            </div>
          </motion.div>
        )}

        {quotes.length === 0 ? (
          <div className="mt-10 text-center" role="status">
            <p className="text-sm text-muted-foreground">No quotes received yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vendor replies are read automatically. Use Check inbox to look now.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 mb-6">
              <Stat label="Quotes in" value={formatNumber(quotes.length)} />
              <Stat
                label="Lowest"
                value={priceStats.lowest !== null ? formatINRCompact(priceStats.lowest) : 'No data'}
              />
              <Stat
                label="Spread"
                value={priceStats.spread !== null ? formatINRCompact(priceStats.spread) : 'No data'}
              />
              <Stat
                label="Fastest"
                value={
                  quotes.some((q) => q.delivery_days !== null)
                    ? `${formatNumber(Math.min(...quotes.filter((q) => q.delivery_days !== null).map((q) => q.delivery_days!)))} days`
                    : 'No estimate'
                }
              />
            </div>

            {wonByNegotiating.length > 0 && (
              <div className="panel mb-5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingDown className="h-4 w-4 text-foreground" aria-hidden="true" />
                  <span className="text-label text-muted-foreground">Won by negotiating</span>
                </div>
                {wonByNegotiating.map((s) => (
                  <p key={s.id} className="text-sm text-foreground">
                    {s.vendor_name} came down from{' '}
                    <span className="font-mono tabular-nums text-muted-foreground line-through">
                      {formatINR(s.total_amount)}
                    </span>{' '}
                    to{' '}
                    <span className="font-mono tabular-nums font-semibold">{formatINR(s.replaced_by!)}</span>. Saved{' '}
                    <span className="font-mono tabular-nums font-semibold">
                      {formatINR(s.total_amount - (s.replaced_by || 0))}
                    </span>
                    .
                  </p>
                ))}
              </div>
            )}

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <div className="panel p-4">
                <p className="mb-4 flex items-center gap-2 text-label text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  What matters to you
                </p>
                <div className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-x-3 gap-y-4">
                  {weightRow('Price', 'price', 'Lower cost wins')}
                  {weightRow('Delivery', 'delivery', 'Sooner wins')}
                  {weightRow('Quality', 'quality', 'Track record, warranty')}
                </div>
              </div>

              {winner && (
                <motion.div
                  key={winner.id}
                  initial={shouldReduceMotion ? false : enterItem(0).initial}
                  animate={enterItem(0).animate}
                  transition={shouldReduceMotion ? { duration: 0 } : enterItem(0).transition}
                  className="panel p-4"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-sunken">
                      <Trophy className="h-4 w-4 text-foreground" aria-hidden="true" />
                    </span>
                    <span className="text-label text-muted-foreground">AI recommended</span>
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    {winner.vendor_name} at <span className="font-mono tabular-nums">{amountOrNull(winner.total_amount)}</span>
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {describeTradeoff(winner, scored)}
                  </p>
                </motion.div>
              )}
            </div>

            <Tabs defaultValue="ranked">
              <TabsList className="mb-4 bg-transparent p-0">
                <TabsTrigger
                  value="ranked"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  Ranked
                </TabsTrigger>
                <TabsTrigger
                  value="table"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  Side by side
                </TabsTrigger>
              </TabsList>

              <TabsContent value="table">
                <QuoteTable quotes={scored} awardedTo={awardedTo} awarding={awarding} onAward={handleAward} />
              </TabsContent>

              <TabsContent value="ranked">
                <div className="overflow-x-auto">
                  <div className="min-w-[680px]">
                    <div className={cn(RANK_GRID, 'px-4 pb-2 text-label text-muted-foreground')} aria-hidden="true">
                      <span />
                      <span>Vendor</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">Delivery</span>
                      <span>Terms</span>
                      <span className="text-right">Score</span>
                      <span />
                    </div>
                    <div role="list" aria-label="Vendors ranked by your weights" className="space-y-2.5">
                      {scored.map((q, i) => {
                        const isWinner = q.rank === 1;
                        const isAwarded = q.status === 'awarded';
                        return (
                          <motion.div
                            key={q.id}
                            layout
                            role="listitem"
                            transition={shouldReduceMotion ? { duration: 0 } : spring.reorder}
                            className={cn(
                              'panel relative overflow-hidden p-4',
                              (isAwarded || isWinner) && 'border-primary/40'
                            )}
                          >
                            {(isAwarded || isWinner) && (
                              <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
                            )}
                            <div className={RANK_GRID}>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">#{q.rank}</span>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate font-semibold text-foreground">{q.vendor_name}</span>
                                  {q.is_cheapest && (
                                    <Chip tone="neutral" icon={<IndianRupee className="h-3 w-3" aria-hidden="true" />}>
                                      Cheapest
                                    </Chip>
                                  )}
                                  {q.is_fastest && (
                                    <Chip tone="neutral" icon={<Zap className="h-3 w-3" aria-hidden="true" />}>
                                      Fastest
                                    </Chip>
                                  )}
                                  {(q.confidence ?? 1) < 0.5 && (
                                    <Chip tone="neutral" icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />}>
                                      Check manually
                                    </Chip>
                                  )}
                                  {isAwarded && (
                                    <Chip tone="neutral" icon={<Check className="h-3 w-3" aria-hidden="true" />}>
                                      Awarded
                                    </Chip>
                                  )}
                                </div>
                              </div>

                              <div className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                                {amountOrNull(q.total_amount)}
                              </div>
                              <div className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                                {q.delivery_days !== null ? `${formatNumber(q.delivery_days)}d` : 'n/a'}
                              </div>
                              <div className="min-w-0 truncate text-sm text-muted-foreground">
                                {q.payment_terms || 'Not specified'}
                              </div>

                              <div className="flex items-center justify-end gap-2.5">
                                <CriteriaBars
                                  scores={[q.price_score, q.delivery_score, q.quality_score]}
                                  vendor={q.vendor_name}
                                />
                                <ScoreOdometer
                                  value={q.total_score * 100}
                                  rowIndex={i}
                                  reduced={!!shouldReduceMotion}
                                />
                              </div>

                              <div className="flex justify-end">
                                {!awardedTo && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAward(q.id, q.vendor_name)}
                                    disabled={awarding !== null}
                                    className="whitespace-nowrap"
                                  >
                                    {awarding === q.id ? 'Awarding…' : 'Award'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

const QuoteTable: React.FC<{
  quotes: ReturnType<typeof scoreQuotes>;
  awardedTo: string | null;
  awarding: string | null;
  onAward: (quoteId: string, vendorName: string) => void;
}> = ({ quotes, awardedTo, awarding, onAward }) => (
  <div className="panel overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Delivery</TableHead>
          <TableHead>Payment terms</TableHead>
          <TableHead className="text-right">Score</TableHead>
          {!awardedTo && <TableHead className="text-right">Action</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotes.map((q) => (
          <TableRow
            key={q.id}
            className={
              q.status === 'awarded' ? 'bg-primary/10' : q.rank === 1 ? 'bg-primary/5' : undefined
            }
          >
            <TableCell className="font-mono text-muted-foreground tabular-nums">{q.rank}</TableCell>
            <TableCell className="font-medium text-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{q.vendor_name}</span>
                {q.rank === 1 && <Trophy className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />}
              </span>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums font-semibold">
              {amountOrNull(q.total_amount)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {q.delivery_days !== null ? `${formatNumber(q.delivery_days)} days` : 'No estimate'}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-muted-foreground">
              {q.payment_terms || 'Not specified'}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
              {formatNumber(Math.round(q.total_score * 100))}
            </TableCell>
            {!awardedTo && (
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant={q.rank === 1 ? 'default' : 'outline'}
                  onClick={() => onAward(q.id, q.vendor_name)}
                  disabled={awarding !== null}
                  className="whitespace-nowrap"
                >
                  {awarding === q.id ? 'Awarding…' : 'Award'}
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="panel px-4 py-3">
    <div className="text-label text-muted-foreground">{label}</div>
    <div className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-foreground">{value}</div>
  </div>
);

/**
 * Price / Delivery / Quality is one nominal series: all three bars share the
 * same hue (series-1). Identity comes from the P / D / Q axis labels below
 * the bars, never from colour, per the dataviz chart rules.
 */
const CriteriaBars: React.FC<{ scores: number[]; vendor: string }> = ({ scores, vendor }) => {
  const names = ['Price', 'Delivery', 'Quality'];
  const letters = ['P', 'D', 'Q'];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-end gap-1" style={{ height: 24 }}>
        {scores.map((s, i) => (
          <span
            key={i}
            title={`${names[i]} score for ${vendor}: ${formatPercent(Math.max(0, Math.min(1, s)))}`}
            style={{ height: `${Math.max(0.15, Math.min(1, s)) * 24}px` }}
            className="w-1.5 rounded-[var(--radius-inner)] bg-series-1"
          />
        ))}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {letters.map((l) => (
          <span key={l} className="w-1.5 text-center text-[9px] font-medium leading-none text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
};

/** A single rolling digit: only re-mounts (and animates) when its character changes. */
const ScoreDigit: React.FC<{ digit: string; delay: number; reduced: boolean }> = ({ digit, delay, reduced }) => (
  <span className="relative inline-block h-[1.2em] w-[0.62em] overflow-hidden text-center">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={digit}
        initial={reduced ? false : { y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduced ? undefined : { y: -14, opacity: 0 }}
        transition={{ ...spring.ui, delay }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {digit}
      </motion.span>
    </AnimatePresence>
  </span>
);

/**
 * The vendor score, rolling like an odometer whenever the weight dial changes
 * it. `rowIndex` staggers the roll 32ms per rank so the whole column cascades
 * top to bottom instead of updating all at once.
 */
const ScoreOdometer: React.FC<{ value: number; rowIndex: number; reduced: boolean }> = ({
  value,
  rowIndex,
  reduced,
}) => {
  const digits = String(Math.max(0, Math.min(100, Math.round(value)))).padStart(2, '0').split('');
  const delay = Math.min(rowIndex, 5) * STAGGER;
  return (
    <div className="text-right">
      <div className="flex justify-end font-mono text-xl font-semibold tabular-nums text-foreground">
        {digits.map((d, i) => (
          <ScoreDigit key={i} digit={d} delay={delay} reduced={reduced} />
        ))}
      </div>
      <div className="text-label text-muted-foreground">Score</div>
    </div>
  );
};

export default QuoteComparison;
