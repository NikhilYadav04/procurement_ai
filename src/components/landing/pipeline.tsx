'use client';

/**
 * The eight scenes the pinned sequence walks through.
 *
 * These are deliberately diagrammatic, not simulated screenshots: no fake
 * window chrome, no invented browser bar. They abstract one stage each so a
 * first-time reader understands what the agent actually does.
 *
 * The worked example is the real one from the Round 1 deck: 250 workstation
 * desks quoted by Kumar, Rapid and Godrej.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FileText,
  Mail,
  Inbox,
  SlidersHorizontal,
  ShieldCheck,
  Check,
  PackageCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { spring, ease, dur } from '@/lib/motion';

export type Step = {
  key: string;
  label: string;
  headline: string;
  body: string;
  icon: React.ReactNode;
};

export const STEPS: Step[] = [
  {
    key: 'describe',
    label: 'Describe it',
    headline: 'Say what you need to buy.',
    body: 'Plain English, the way you would put it to a colleague. No form, no category tree, no supplier codes.',
    icon: <Inbox className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'rfp',
    label: 'RFP drafted',
    headline: 'It writes the RFP and numbers it.',
    body: 'Requirements become a formatted, numbered document ready to send. You review it before anything leaves.',
    icon: <FileText className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'sent',
    label: 'Sent to vendors',
    headline: 'It emails your suppliers from your own inbox.',
    body: 'Sent through your Gmail, so replies come back to you and the thread stays yours.',
    icon: <Mail className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'read',
    label: 'Quotes read',
    headline: 'It reads whatever comes back.',
    body: 'A PDF, a photographed letterhead, four lines in a mail body. All three are parsed into the same fields.',
    icon: <Inbox className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'rank',
    label: 'Ranked on your weights',
    headline: 'You decide what matters. It re-ranks.',
    body: 'Raise the delivery weight and the order changes. Every score is computed by a plain function, never by the model.',
    icon: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'award',
    label: 'Awarded',
    headline: 'You award. It issues the purchase order.',
    body: 'Both GSTINs, the supplier’s Udyam number and the Section 15 clause are printed on it, then it goes to their inbox.',
    icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'accept',
    label: 'Goods accepted',
    headline: 'The clock starts when you accept, not when they invoice.',
    body: 'Forty-five days from acceptance, or fifteen if nothing was agreed in writing. Object to the goods and the clock stops until the objection is removed.',
    icon: <PackageCheck className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'papers',
    label: 'Paperwork ready',
    headline: 'Your accountant gets the working papers.',
    body: 'The register, the four Form MSME-1 buckets and the Clause 22 figures, exportable the day they are asked for.',
    icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
  },
];

const VENDORS = [
  { name: 'Kumar Furnishings', amount: '₹31,20,000', days: '45 days', note: 'Cheapest' },
  { name: 'Rapid Interiors', amount: '₹33,50,000', days: '21 days', note: 'Fastest' },
  { name: 'Godrej Interio', amount: '₹34,80,000', days: '30 days', note: 'Longest warranty' },
];

/* -------------------------------------------------------------------------- */

const Frame: React.FC<{ children: React.ReactNode; caption?: string }> = ({ children, caption }) => (
  <div className="w-full">
    <div className="rounded-[var(--radius)] border border-border bg-surface p-6 shadow-[0_24px_60px_-32px_hsl(220_12%_9%/0.35)] sm:p-8">
      {children}
    </div>
    {caption ? (
      <p className="mt-3 text-label text-muted-foreground">{caption}</p>
    ) : null}
  </div>
);

const rowIn = (i: number, reduce: boolean) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: dur.enter, ease: ease.standard, delay: 0.06 + i * 0.08 },
      };

/* -------------------------------------------------------------------------- */

const SceneDescribe: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="What you type">
    <div className="rounded-[var(--radius-inner)] border border-border bg-sunken px-4 py-4">
      <p className="text-pretty text-base leading-relaxed text-foreground sm:text-lg">
        I need 250 workstation desks. Get quotes from Kumar, Rapid and Godrej.
        {!reduce && (
          <motion.span
            aria-hidden="true"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
            className="ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 bg-primary"
          />
        )}
      </p>
    </div>
  </Frame>
);

const SceneRfp: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Drafted in about nine seconds">
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <div className="figure text-sm font-semibold text-foreground">RFP-0042</div>
        <div className="text-label text-muted-foreground">250 workstation desks</div>
      </div>
      <span className="rounded-[var(--radius-inner)] border border-border bg-sunken px-2.5 py-1 text-label text-muted-foreground">
        12 line items
      </span>
    </div>
    <div className="mt-5 space-y-2.5">
      {[100, 82, 91, 64, 74].map((w, i) => (
        <motion.div
          key={i}
          {...(reduce
            ? {}
            : {
                initial: { scaleX: 0, opacity: 0 },
                animate: { scaleX: 1, opacity: 1 },
                transition: { duration: 0.34, ease: ease.standard, delay: i * 0.07 },
              })}
          style={{ width: `${w}%`, transformOrigin: '0% 50%' }}
          className="h-2.5 rounded-full bg-secondary"
        />
      ))}
    </div>
  </Frame>
);

const SceneSent: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Sent from your own Gmail">
    <ul className="divide-y divide-border">
      {VENDORS.map((v, i) => (
        <motion.li key={v.name} {...rowIn(i, reduce)} className="flex items-center gap-3 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-sunken">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{v.name}</span>
          <span className="inline-flex items-center gap-1.5 text-label text-safe">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Sent
          </span>
        </motion.li>
      ))}
    </ul>
  </Frame>
);

const FORMATS = [
  { fmt: 'PDF attachment', vendor: 'Kumar Furnishings', amount: '₹31,20,000' },
  { fmt: 'Photographed letterhead', vendor: 'Rapid Interiors', amount: '₹33,50,000' },
  { fmt: 'Four lines in the mail body', vendor: 'Godrej Interio', amount: '₹34,80,000' },
];

const SceneRead: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Three formats, one set of fields">
    <div className="grid gap-3 sm:grid-cols-3">
      {FORMATS.map((f, i) => (
        <motion.div
          key={f.vendor}
          {...rowIn(i, reduce)}
          className="rounded-[var(--radius-inner)] border border-border bg-sunken p-4"
        >
          <div className="text-label text-muted-foreground">{f.fmt}</div>
          <div className="mt-3 truncate text-sm font-medium text-foreground">{f.vendor}</div>
          <div className="figure mt-1 text-base font-semibold text-foreground">{f.amount}</div>
        </motion.div>
      ))}
    </div>
  </Frame>
);

const SceneRank: React.FC<{ reduce: boolean }> = ({ reduce }) => {
  // Delivery is weighted up, so the fastest supplier takes the top slot.
  const ranked = [VENDORS[1], VENDORS[0], VENDORS[2]];
  const widths = [100, 88, 72];

  return (
    <Frame caption="Delivery weighted up, so the ranking flipped">
      <div className="mb-5 flex flex-wrap gap-2">
        {['Price 30%', 'Delivery 50%', 'Quality 20%'].map((chip) => (
          <span
            key={chip}
            className="figure rounded-[var(--radius-inner)] border border-border bg-sunken px-2.5 py-1 text-label text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
      <ul className="space-y-4">
        {ranked.map((v, i) => (
          <motion.li key={v.name} layout transition={spring.reorder}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-foreground">
                {i === 0 ? <span className="text-primary">1. </span> : `${i + 1}. `}
                {v.name}
              </span>
              <span className="figure shrink-0 text-sm text-muted-foreground">
                {v.amount}, {v.days}
              </span>
            </div>
            <motion.div
              {...(reduce
                ? {}
                : {
                    initial: { scaleX: 0 },
                    animate: { scaleX: 1 },
                    transition: { duration: 0.45, ease: ease.standard, delay: i * 0.08 },
                  })}
              style={{ width: `${widths[i]}%`, transformOrigin: '0% 50%' }}
              className={`mt-2 h-2.5 rounded-full ${i === 0 ? 'bg-series-1' : 'bg-secondary'}`}
            />
          </motion.li>
        ))}
      </ul>
    </Frame>
  );
};

const PO_FIELDS = [
  { k: 'Buyer GSTIN', v: '27AAPFU0939F1ZV' },
  { k: 'Supplier GSTIN', v: '29AAGCB7383J1Z4' },
  { k: 'Udyam', v: 'UDYAM-KR-03-0017740' },
  { k: 'MSME status', v: 'Small, service' },
] as const;

const SceneAward: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Example data">
    <div className="flex items-baseline justify-between border-b border-border pb-4">
      <div>
        <div className="figure text-sm font-semibold text-foreground">PO-0007</div>
        <div className="text-label text-muted-foreground">Rapid Interiors</div>
      </div>
      <div className="figure text-xl font-semibold text-foreground">₹33,50,000</div>
    </div>

    <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {PO_FIELDS.map((f, i) => (
        <motion.div key={f.k} {...rowIn(i, reduce)}>
          <dt className="text-label text-muted-foreground">{f.k}</dt>
          <dd className="figure mt-0.5 truncate text-sm font-medium text-foreground">{f.v}</dd>
        </motion.div>
      ))}
    </dl>

    <p className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
      &ldquo;Payment falls due within 45 days of acceptance of the goods &hellip; Section 15 of
      the Micro, Small and Medium Enterprises Development Act, 2006.&rdquo;
    </p>
  </Frame>
);

/* -------------------------------------------------------------------------- */

const CLOCK_MARKS = [
  { day: 'Day 0', label: 'Delivered', tone: 'muted' },
  { day: 'Day 2', label: 'Accepted', tone: 'start' },
  { day: 'Day 30', label: 'First warning', tone: 'muted' },
  { day: 'Day 40', label: 'Urgent', tone: 'watch' },
  { day: 'Day 45', label: 'Deduction lost', tone: 'breach' },
] as const;

const SceneAccept: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="The invoice date is not on this line, and that is the point">
    <ol className="flex items-start justify-between gap-1">
      {CLOCK_MARKS.map((m, i) => (
        <motion.li key={m.day} {...rowIn(i, reduce)} className="min-w-0 flex-1 text-center">
          <span
            aria-hidden="true"
            className={`mx-auto block h-2.5 w-2.5 rounded-full ${
              m.tone === 'start'
                ? 'bg-foreground'
                : m.tone === 'watch'
                  ? 'bg-watch'
                  : m.tone === 'breach'
                    ? 'bg-breach'
                    : 'bg-border'
            }`}
          />
          <span className="figure mt-2.5 block text-label text-muted-foreground">{m.day}</span>
          <span
            className={`mt-0.5 block truncate text-[11px] font-medium sm:text-xs ${
              m.tone === 'breach'
                ? 'text-breach'
                : m.tone === 'watch'
                  ? 'text-watch'
                  : m.tone === 'start'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
            }`}
          >
            {m.label}
          </span>
        </motion.li>
      ))}
    </ol>

    <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
      <div className="rounded-[var(--radius-inner)] border border-border bg-sunken p-4">
        <div className="text-label text-muted-foreground">No written term</div>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          The window is <span className="figure font-semibold">15 days</span>, not 45.
        </p>
      </div>
      <div className="rounded-[var(--radius-inner)] border border-border bg-sunken p-4">
        <div className="text-label text-muted-foreground">Objection raised</div>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          The clock stops. It restarts the day the objection is removed.
        </p>
      </div>
    </div>
  </Frame>
);

const BUCKETS = [
  { n: '1', k: 'Outstanding beyond 45 days', tone: 'breach' },
  { n: '5', k: 'Outstanding, 45 days not yet over', tone: 'plain' },
  { n: '1', k: 'Paid after 45 days', tone: 'watch' },
  { n: '1', k: 'Paid within 45 days', tone: 'plain' },
] as const;

const ScenePapers: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Example data, from the four buckets the MCA form asks for">
    <div className="flex items-baseline justify-between border-b border-border pb-4">
      <span className="text-sm font-semibold text-foreground">Form MSME-1</span>
      <span className="figure text-label text-muted-foreground">Due 31 October</span>
    </div>

    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
      {BUCKETS.map((b, i) => (
        <motion.div key={b.k} {...rowIn(i, reduce)}>
          <dt
            className={`figure text-2xl font-semibold ${
              b.tone === 'breach' ? 'text-breach' : b.tone === 'watch' ? 'text-watch' : 'text-foreground'
            }`}
          >
            {b.n}
          </dt>
          <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{b.k}</dd>
        </motion.div>
      ))}
    </dl>

    <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
      {['43B(h) register', 'Clause 22 of Form 3CD', 'CSV', 'PDF'].map((chip) => (
        <span
          key={chip}
          className="rounded-[var(--radius-inner)] border border-border bg-sunken px-2.5 py-1 text-label text-muted-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  </Frame>
);

/* -------------------------------------------------------------------------- */

export const SCENES: Record<string, React.FC<{ reduce: boolean }>> = {
  describe: SceneDescribe,
  rfp: SceneRfp,
  sent: SceneSent,
  read: SceneRead,
  rank: SceneRank,
  award: SceneAward,
  accept: SceneAccept,
  papers: ScenePapers,
};

export const Scene: React.FC<{ stepKey: string }> = ({ stepKey }) => {
  const reduce = !!useReducedMotion();
  const Cmp = SCENES[stepKey];
  return <Cmp reduce={reduce} />;
};
