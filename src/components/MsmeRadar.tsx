import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, X } from 'lucide-react';
import { type ComplianceRow, STATUTORY_CAP_DAYS } from '@/lib/msmeCompliance';
import { formatINR, formatDate, formatNumber } from '@/lib/format';
import { spring, enterItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface MsmeRadarProps {
  customerEmail: string;
  /** Optional. When given, the header shows a control to dismiss the card,
   *  laid out beside the expand chevron rather than on top of it. */
  onHide?: () => void;
}

interface Summary {
  amount_at_risk: number;
  tax_at_risk?: number;
  interest_accrued?: number;
  total_cost_if_unpaid?: number;
  unverified_msme?: number;
  current_fy?: string;
  days_to_fy_end?: number;
  breached: number;
  urgent: number;
  due_soon: number;
  safe: number;
  awaiting_invoice: number;
  paid_on_time: number;
  paid_late: number;
  amount_paid_late: number;
  total_msme_pos: number;
  total_pos: number;
  worst: ComplianceRow | null;
  rows: ComplianceRow[];
}

type ClockTone = 'ink' | 'watch' | 'breach' | 'safe';

/** safe / watch / breach are reserved for this clock. Never reused elsewhere. */
const CLOCK_COLOR: Record<ClockTone, string> = {
  ink: 'hsl(var(--foreground))',
  watch: 'hsl(var(--watch))',
  breach: 'hsl(var(--breach))',
  safe: 'hsl(var(--safe))',
};

const CLOCK_TEXT_CLASS: Record<ClockTone, string> = {
  ink: 'text-foreground',
  watch: 'text-[hsl(var(--watch))]',
  breach: 'text-[hsl(var(--breach))]',
  safe: 'text-[hsl(var(--safe))]',
};

const toneFor = (row: ComplianceRow): ClockTone => {
  if (row.state === 'paid') {
    return row.days_elapsed !== null && row.deadline_days && row.days_elapsed > row.deadline_days
      ? 'breach'
      : 'safe';
  }
  if (row.state === 'breached') return 'breach';
  if (row.state === 'urgent' || row.state === 'due_soon') return 'watch';
  return 'ink';
};

const deadlineMoment = (r: ComplianceRow): number | null => {
  if (r.due_date) {
    const due = new Date(r.due_date + 'T00:00:00');
    if (!Number.isNaN(due.getTime())) return due.getTime();
  }

  if (!r.clock_start || !r.deadline_days) return null;

  const start = new Date(r.clock_start);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  return start.getTime() + r.deadline_days * 86400000;
};

const pad = (n: number) => String(n).padStart(2, '0');

const formatCountdown = (ms: number, engineDays?: number | null): string => {
  const over = ms < 0;
  const total = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const days = engineDays === null || engineDays === undefined
    ? Math.floor(total / 86400)
    : Math.abs(engineDays);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${over ? 'Over by ' : ''}${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}${over ? '' : ' left'}`;
};

/** What to do about it, in one line. Never the library's own prose, so every number can go through format.ts. */
const owed = (row: ComplianceRow): number => {
  const outstanding = Number(row.outstanding);
  return Number.isFinite(outstanding) ? outstanding : Number(row.total_amount);
};

const partPaidNote = (row: ComplianceRow): string => {
  const paid = Number(row.amount_paid ?? 0);
  if (!paid || paid <= 0) return '';
  return ` ${formatINR(paid)} of ${formatINR(Number(row.total_amount))} is already paid.`;
};

const captionFor = (row: ComplianceRow): string => {
  const amount = formatINR(owed(row));
  if (row.state === 'paid') {
    const settled = formatINR(Number(row.total_amount));
    if (row.days_elapsed !== null && row.deadline_days && row.days_elapsed > row.deadline_days) {
      return `Paid ${formatNumber(row.days_elapsed - row.deadline_days)} days late. The ${settled} deduction moved to this year.`;
    }
    return `Paid on time. ${settled} deduction secured.`;
  }
  if (row.state === 'breached') {
    return `${formatNumber(Math.abs(row.days_left ?? 0))} days over the limit. ${amount} deduction deferred, plus interest.${partPaidNote(row)}`;
  }
  if (row.due_date) {
    return `Pay by ${formatDate(row.due_date)} to keep ${amount}.${partPaidNote(row)}`;
  }
  return `Clock has not started. No invoice received yet.`;
};


/**
 * One invoice, one deadline track.
 *
 * A ring was the wrong form here. A circle can only express "fraction of a
 * whole", so once an invoice passes day 45 the arc simply completes and reads
 * as a plain red disc, which is precisely the case that matters most. A linear
 * track carries the scale, the current day, the statutory limit as a marked
 * threshold, and any overshoot past it.
 *
 * The scale stretches when a row is overdue, so the limit marker slides left
 * and the bar visibly runs past it.
 *
 * `variant="full"` is the feature card; `variant="row"` is the compact form
 * used in the per-invoice list.
 */
/**
 * One invoice, one countdown ring.
 *
 * The ring DEPLETES rather than fills: a filling arc is a progress bar bent
 * into a circle and reads as health, where this has to read as time running
 * out. The day figure sits inside the ring, so an overdue invoice is never a
 * meaningless red disc, which is what the first version got wrong. Once past
 * the deadline the ring is full and the centre switches to days over.
 *
 * No per-second state: a setState per row per second took hydration down.
 * The elapsed figure is read from the clock at render behind a mounted flag,
 * and the live countdown is written to a ref's textContent.
 */
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

const DeadlineRing: React.FC<{
  row: ComplianceRow;
  variant?: 'full' | 'row';
}> = ({ row, variant = 'row' }) => {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const countdownRef = useRef<HTMLSpanElement>(null);
  const tone = toneFor(row);
  const limit = row.deadline_days || STATUTORY_CAP_DAYS;
  const deadline = deadlineMoment(row);
  const live = row.state !== 'paid' && row.state !== 'not_applicable' && deadline !== null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!live || deadline === null) return;
    const write = () => {
      if (countdownRef.current) {
        countdownRef.current.textContent = formatCountdown(deadline - Date.now(), row.days_left);
      }
    };
    write();
    if (reducedMotion) return;
    const id = setInterval(write, 1000);
    return () => clearInterval(id);
  }, [live, deadline, reducedMotion, row.days_left]);

  if (!mounted || !live || deadline === null) return null;

  const msLeft = deadline - Date.now();
  const over = row.days_left === null ? msLeft <= 0 : row.days_left < 0;
  const daysLeft = row.days_left ?? Math.ceil(msLeft / 86400000);
  const daysOver = row.days_left === null ? Math.floor(-msLeft / 86400000) : Math.abs(row.days_left);
  // Fraction of the window still available. Overdue pins the ring full.
  const remaining = over ? 1 : Math.max(0, Math.min(1, msLeft / (limit * 86400000)));
  const dayReached = over ? limit + daysOver : Math.max(0, limit - daysLeft);
  const full = variant === 'full';
  const size = full ? 88 : 36;

  return (
    <div className={cn('flex items-center gap-3', full ? 'min-w-0 flex-wrap' : 'shrink-0')}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 64 64" role="img"
          aria-label={over ? `${daysOver} days past the ${limit} day limit` : `${daysLeft} days left of ${limit}`}>
          <circle cx="32" cy="32" r={RING_R} fill="none" strokeWidth="6" className="stroke-border" />
          <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            <motion.circle
              cx="32" cy="32" r={RING_R} fill="none" strokeWidth="6" strokeLinecap="round"
              transform="rotate(-90 32 32)"
              style={{ stroke: CLOCK_COLOR[tone], strokeDasharray: RING_C }}
              initial={reducedMotion ? false : { strokeDashoffset: RING_C }}
              animate={{ strokeDashoffset: RING_C * (1 - remaining) }}
              transition={reducedMotion ? { duration: 0 } : spring.surface}
            />
          </g>
        </svg>
        {full && (
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-mono text-base font-semibold leading-none tabular-nums', CLOCK_TEXT_CLASS[tone])}>
              {over ? daysOver : Math.max(0, daysLeft)}d
            </span>
            <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              {over ? 'over' : 'left'}
            </span>
          </span>
        )}
      </div>

      {full && (
        <div className="min-w-0">
          <p className={cn('font-mono text-sm font-semibold tabular-nums', CLOCK_TEXT_CLASS[tone])}>
            Day {dayReached} of {limit}
          </p>
          <span ref={countdownRef}
            className={cn('block truncate font-mono text-xs tabular-nums', CLOCK_TEXT_CLASS[tone])} />
        </div>
      )}
      {!full && (
        <span ref={countdownRef}
          className={cn('font-mono text-[10px] leading-none tabular-nums', CLOCK_TEXT_CLASS[tone])} />
      )}
    </div>
  );
};

export const MsmeRadar: React.FC<MsmeRadarProps> = ({ customerEmail, onHide }) => {
  const shouldReduceMotion = useReducedMotion();
  const [data, setData] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/compliance/summary?customerEmail=${encodeURIComponent(customerEmail)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerEmail]);

  if (!data || data.total_pos === 0) return null;

  const atRisk = data.amount_at_risk > 0;
  const hasLatePayments = data.paid_late > 0;
  const tracked = data.rows.filter((r) => r.state !== 'not_applicable');
  const worst = data.worst;

  const headline = atRisk
    ? `${formatINR(data.tax_at_risk ?? 0)} of deduction leaves ${data.current_fy ?? 'this year'} unless ${formatINR(
        data.amount_at_risk
      )} is paid across ${formatNumber(data.breached + data.urgent)} order${data.breached + data.urgent > 1 ? 's' : ''}`
    : hasLatePayments
    ? `${formatNumber(data.paid_late)} payment${data.paid_late > 1 ? 's' : ''} settled late. ${formatINR(
        data.amount_paid_late
      )} of deduction already deferred.`
    : data.total_msme_pos === 0
    ? 'No MSME suppliers on any purchase order.'
    : `All ${formatNumber(data.total_msme_pos)} MSME payment${data.total_msme_pos > 1 ? 's' : ''} inside the deadline.`;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : enterItem(0).initial}
      animate={enterItem(0).animate}
      transition={shouldReduceMotion ? { duration: 0 } : enterItem(0).transition}
      className="panel relative overflow-hidden"
    >
      <button
        onClick={() => tracked.length > 0 && setOpen(!open)}
        disabled={tracked.length === 0}
        aria-expanded={open}
        aria-controls="msme-detail-list"
        className="w-full flex items-start gap-3.5 py-3.5 pl-4 pr-14 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-sunken">
          {atRisk ? (
            <ShieldAlert className={cn('h-5 w-5', CLOCK_TEXT_CLASS.breach)} aria-hidden="true" />
          ) : hasLatePayments ? (
            <ShieldAlert className={cn('h-5 w-5', CLOCK_TEXT_CLASS.watch)} aria-hidden="true" />
          ) : (
            <ShieldCheck className={cn('h-5 w-5', CLOCK_TEXT_CLASS.safe)} aria-hidden="true" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-label text-muted-foreground">Section 43B(h) payment clock</p>

          <p className="mt-1 text-base font-semibold leading-snug text-foreground [text-wrap:balance]" aria-live="polite">
            {headline}
          </p>

          {atRisk && worst ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <DeadlineRing row={worst} variant="full" />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono tabular-nums">{worst.po_number}</span>
                  <span className="mx-1.5 opacity-40">&middot;</span>
                  {worst.vendor_name}
                </p>
                <p className="mt-0.5 text-sm text-foreground">{captionFor(worst)}</p>
                {data.interest_accrued ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatINR(data.interest_accrued)} of interest has accrued at three times the RBI bank rate,
                    compounded monthly.
                  </p>
                ) : null}
              </div>
            </div>
          ) : hasLatePayments ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Paying late does not undo it. Interest still accrues at three times the RBI bank rate.
            </p>
          ) : null}
        </div>

        {tracked.length > 0 && (
          <span className="mt-0.5 flex shrink-0 items-center text-muted-foreground">
            {open ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        )}
      </button>

      {/* Dismiss. A sibling of the header button, separated by a rule, so the
          two controls never sit on top of one another. */}
      {onHide && (
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide the payment clock"
            className="rounded-[var(--radius-inner)] p-1 text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Full ledger as a slide-over, not inline.
          A 380px rail cannot hold a PO number, a vendor, a rupee figure and a
          caption on one line, which is why every row was truncating. The rail
          keeps the summary; the detail gets a panel wide enough to read. */}
      {mounted && createPortal(
      <AnimatePresence>
        {open && tracked.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[70] bg-black/25"
              aria-hidden="true"
            />
            <motion.div
              id="msme-detail-list"
              role="dialog"
              aria-label="Every tracked MSME payment"
              initial={shouldReduceMotion ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
              transition={shouldReduceMotion ? { duration: 0 } : spring.surface}
              className="fixed right-0 top-0 z-[75] flex h-full w-full max-w-[34rem] flex-col border-l border-border bg-surface"
            >
              <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <p className="text-label text-muted-foreground">Section 43B(h)</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    {formatNumber(tracked.length)} tracked payment{tracked.length > 1 ? 's' : ''}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-[var(--radius-inner)] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <ul className="flex-1 divide-y divide-border overflow-y-auto">
                {tracked.map((r, i) => (
                  <motion.li key={r.id} {...enterItem(i)} className="flex items-start gap-4 px-6 py-4">
                    <DeadlineRing row={r} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {r.po_number}
                        </span>
                        <span className="text-sm font-medium text-foreground">{r.vendor_name}</span>
                      </div>
                      <p className="figure mt-1 text-base font-semibold text-foreground">
                        {formatINR(r.state === 'paid' ? Number(r.total_amount) : owed(r))}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {captionFor(r)}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body)}
    </motion.div>
  );
};

export default MsmeRadar;
