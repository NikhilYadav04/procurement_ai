import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion';
import {
  ArrowUpRight,
  Menu,
  X,
  Check,
  AlertTriangle,
  HardHat,
  Factory,
  Building2,
  ShieldQuestion,
  BellRing,
} from 'lucide-react';
import { spring, press, enterItem, dur, ease } from '../lib/motion';
import {
  ScrimPhoto,
  TiltIn,
  Parallax,
  PinnedStage,
  usePinnedSequence,
  Marquee,
  ShotFrame,
} from '@/components/landing/scroll';
import { STEPS, Scene } from '@/components/landing/pipeline';

const CTA_LABEL = 'Get started free';

/**
 * Hero photograph.
 * A real Unsplash image, not a picsum seed. picsum ignores the seed's meaning
 * and returns a random photo, which is how "warehouse-racking" resolved to a
 * mountain range. Unsplash serves free hotlinked images and this one is
 * actually a warehouse.
 */
const PHOTO = {
  warehouse: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=2400&q=80&auto=format&fit=crop',
} as const;

/**
 * Product screenshots. Both are live captures of the running app on the
 * Ledger surface.
 */
const SHOT = {
  dashboard: { src: '/shots/app-dashboard.png', w: 1760, h: 1080 },
  quotes: { src: '/shots/app-quote-comparison.png', w: 1907, h: 930 },
} as const;

/** whileInView reveal built from the shared enterItem token, never hand-written. */
function revealAt(idx: number, reduceMotion: boolean) {
  if (reduceMotion) {
    return { initial: false as const };
  }
  const item = enterItem(idx);
  return {
    initial: item.initial,
    whileInView: item.animate,
    viewport: { once: true, margin: '-80px' },
    transition: item.transition,
  };
}

const NAV_ITEMS = [
  { label: 'How it works', id: 'how-it-works' },
  { label: 'Features', id: 'features' },
  { label: 'Compliance', id: 'compliance' },
  { label: 'Industries', id: 'industries' },
  { label: 'Demo', id: 'demo' },
];

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** The one CTA with spring hover physics, per the motion spec. */
const PrimaryButton = ({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      whileTap={shouldReduceMotion ? undefined : press}
      transition={spring.ui}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-inner)] bg-primary font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {children}
    </motion.button>
  );
};

const Navbar = () => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // The page opens on a full-bleed dark photograph, so the nav carries its
  // surface from the first frame. Fading it in would leave dark nav text on a
  // dark image above the fold.
  const { scrollY } = useScroll();
  const navBgOpacity = useTransform(scrollY, [0, 80], [0.92, 1]);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center px-4 pt-4 sm:px-6 sm:pt-5">
      <div className="relative flex w-full max-w-6xl items-center justify-between rounded-[var(--radius)] px-5 py-2.5">
        <motion.div
          aria-hidden="true"
          style={{ opacity: navBgOpacity }}
          className="glass absolute inset-0 -z-10 rounded-[var(--radius)]"
        />

        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[var(--radius-inner)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/procurixlogo_lightmode.png"
            alt="Procurix"
            width={32}
            height={32}
            className="object-contain"
          />
          <span className="text-lg font-semibold tracking-tight text-foreground">Procurix</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="rounded-[var(--radius-inner)] px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Log in
          </button>
          <PrimaryButton onClick={() => router.push('/login')} className="px-5 py-2 text-sm">
            {CTA_LABEL}
          </PrimaryButton>
        </div>

        <button
          type="button"
          className="rounded-[var(--radius-inner)] p-2 text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="absolute left-4 right-4 top-[68px] z-50 rounded-[var(--radius)] border border-border bg-background p-5 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    scrollToSection(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-[var(--radius-inner)] px-3 py-3 text-left text-base font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="px-3 py-3 text-left text-base font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                Log in
              </button>
              <PrimaryButton
                onClick={() => router.push('/login')}
                className="mt-2 w-full justify-center py-3"
              >
                {CTA_LABEL}
              </PrimaryButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

/* ========================================================================= */

/* ========================================================================= */

const BUY_ITEMS = [
  'Steel sections',
  'Fasteners',
  'Safety gear',
  'Site consumables',
  'Workstation furniture',
  'Packaging',
  'Electrical fittings',
  'Storage racking',
];

/* ========================================================================= */

/** Full-bleed photograph carrying the problem. Type sits on a scrim. */
/** The opening. The stakes, over a photograph, with the primary action. */
const Problem = () => {
  const router = useRouter();

  return (
  <ScrimPhoto
    src={PHOTO.warehouse}
    alt="Warehouse racking stacked with palletised stock"
    width={2000}
    height={1200}
    className="flex min-h-[100dvh] items-center px-6 pb-20 pt-28 sm:pb-24"
    priority
  >
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-label text-white/70">Built for Indian procurement</p>
      <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
        Buying is still email. And since 2023, paying late is a tax event.
      </h2>
      <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
        Five suppliers, five formats, one spreadsheet. A PDF, a photographed
        letterhead, four lines in a mail body, all retyped by hand.
      </p>

      <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
        {[
          { v: '45 days', k: 'To pay a Udyam-registered supplier' },
          { v: '3× bank rate', k: 'Interest, compounded, non-deductible' },
          { v: '2 weeks', k: 'Spent chasing quotes by hand' },
          { v: '10 months', k: 'Before an audit finds the breach' },
        ].map((s) => (
          <div key={s.v}>
            <dt className="figure flex min-h-[4.5rem] items-start text-2xl font-semibold leading-tight text-white sm:min-h-[4.75rem] sm:text-3xl">
              {s.v}
            </dt>
            <dd className="text-sm leading-snug text-white/75">{s.k}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <PrimaryButton
          onClick={() => router.push('/login')}
          className="w-full px-7 py-3.5 text-base sm:w-auto"
        >
          {CTA_LABEL}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </PrimaryButton>
        <button
          type="button"
          onClick={() => scrollToSection('how-it-works')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-inner)] border border-white/25 bg-white/10 px-7 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
        >
          See how it works
        </button>
      </div>
    </div>
  </ScrimPhoto>
  );
};

/* ========================================================================= */

/**
 * The centrepiece. The stage pins to the viewport and scroll walks through the
 * six stages of a real sourcing run, so the reader learns what the product does
 * by watching it happen rather than by reading a feature list.
 *
 * Every scroll position inside the track has content, which is what keeps a
 * pinned section from reading as blank space.
 */
const Pipeline = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const { index } = usePinnedSequence(trackRef, STEPS.length);
  const active = STEPS[index];

  return (
    <section id="how-it-works" className="relative">
      <PinnedStage trackRef={trackRef} steps={STEPS.length}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
            <div className="min-w-0">
              <p className="text-label text-muted-foreground">One request, start to finish</p>

              <div className="relative mt-4 min-h-[11rem] sm:min-h-[10rem]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: dur.enter, ease: ease.standard }}
                  >
                    <h2 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                      {active.headline}
                    </h2>
                    <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
                      {active.body}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress rail. Names every stage, and shows where you are. */}
              <ol className="mt-8 space-y-1">
                {STEPS.map((step, i) => {
                  const done = i < index;
                  const current = i === index;
                  return (
                    <li key={step.key} className="relative flex items-center gap-3 py-1.5">
                      <span
                        aria-hidden="true"
                        className={`h-[2px] w-6 shrink-0 rounded-full transition-colors duration-200 ${
                          current ? 'bg-primary' : done ? 'bg-muted-foreground/50' : 'bg-border'
                        }`}
                      />
                      <span
                        className={`truncate text-sm transition-colors duration-200 ${
                          current
                            ? 'font-semibold text-foreground'
                            : done
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground/55'
                        }`}
                      >
                        {step.label}
                      </span>
                      {current && (
                        <motion.span
                          layoutId="pipeline-marker"
                          transition={spring.ui}
                          aria-hidden="true"
                          className="absolute -left-3 h-5 w-[2px] rounded-full bg-primary"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.key}
                  initial={{ opacity: 0, y: 16, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.99 }}
                  transition={spring.surface}
                >
                  <Scene stepKey={active.key} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </PinnedStage>
    </section>
  );
};

/* ========================================================================= */

/** The product itself, once the reader knows what it does. */
const ProductShot = () => {
  return (
    <section id="features" className="relative px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Procurement, on autopilot
          </h2>
          <p className="mx-auto mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            One place for the request, the replies and the deadline. No figure on
            these screens was written by a model.
          </p>
        </div>

        {/* The agent surface, rising into view. */}
        <div className="relative">
          <TiltIn degrees={16}>
            <ShotFrame
              src={SHOT.dashboard.src}
              alt="The Procurix dashboard, showing the day's sourcing briefing and the agent chat"
              width={SHOT.dashboard.w}
              height={SHOT.dashboard.h}
            />
          </TiltIn>

          {/* Floating facts, moving faster than the shot behind them. */}
          <Parallax
            distance={-120}
            className="pointer-events-none absolute bottom-10 left-6 hidden sm:block lg:left-10"
          >
            <div className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 shadow-[var(--card-halo)]">
              <div className="text-label text-muted-foreground">Awarded</div>
              <div className="figure mt-0.5 text-lg font-semibold text-foreground">₹24,50,000</div>
              <div className="text-label text-safe">13.2% under the highest quote</div>
            </div>
          </Parallax>

          <Parallax
            distance={-190}
            className="pointer-events-none absolute right-6 top-24 hidden sm:block lg:right-10"
          >
            <div className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 shadow-[var(--card-halo)]">
              <div className="text-label text-muted-foreground">Section 43B(h)</div>
              <div className="figure mt-0.5 text-lg font-semibold text-foreground">Day 42 of 45</div>
              <div className="text-label text-watch">Pay by 12 Feb</div>
            </div>
          </Parallax>
        </div>

        <div className="mx-auto mt-24 max-w-2xl text-center">
          <h3 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            Every quote, side by side
          </h3>
          <p className="mx-auto mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
            Move what matters and the ranking moves with it.
          </p>
        </div>

        <div className="mt-10">
          <TiltIn degrees={16} className="mx-auto max-w-5xl">
            <ShotFrame
              src={SHOT.quotes.src}
              alt="Quote comparison showing three vendors ranked by price, delivery and quality"
              width={SHOT.quotes.w}
              height={SHOT.quotes.h}
            />
          </TiltIn>
        </div>
      </div>
    </section>
  );
};

/* ========================================================================= */

/** Counted from the codebase, not estimated. */
const PROOF = [
  { n: '19', k: 'agent tools' },
  { n: '35', k: 'API routes' },
  { n: '13', k: 'screens' },
  { n: '16', k: 'database tables' },
] as const;

const Proof = () => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <section className="relative border-y border-border px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <motion.dl
          {...revealAt(0, !!shouldReduceMotion)}
          className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4"
        >
          {PROOF.map((p) => (
            <div key={p.k}>
              <dt className="figure text-3xl font-semibold text-foreground sm:text-4xl">{p.n}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{p.k}</dd>
            </div>
          ))}
        </motion.dl>
        <p className="mt-8 text-sm text-muted-foreground">
          Working software, not a concept. Every figure counted from the repository.
        </p>
      </div>
    </section>
  );
};

/* ========================================================================= */

const LIMITS = [
  {
    t: 'It does not find suppliers for you',
    d: 'No discovery, no marketplace, no directory. Every vendor is added by you, one at a time or in bulk.',
  },
  {
    t: 'GSTIN is validated, not looked up',
    d: 'The 15-character format, the state code, the PAN inside it and the mod-36 check digit are all verified offline, so an invented number is caught without a network call. The live government registry lookup is written but not configured.',
  },
  {
    t: 'MSME status is recorded, not proven',
    d: 'Because of the above, whether a supplier is Udyam-registered comes from what was entered. The agent will email a supplier and ask, then store their answer with the date and the source, but that is still a declaration rather than a registry check. A supplier nobody confirmed shows as exactly that, rather than being quietly assumed safe.',
  },
  {
    t: 'It prepares the filing, it does not file it',
    d: 'The four Form MSME-1 buckets and the Clause 22 figures come out as CSV and PDF working papers, ready for your accountant. Submitting to the MCA is still yours to do, on 31 October and 30 April.',
  },
  {
    t: 'Interest is computed, not read from your books',
    d: 'The Section 16 figure is derived from the dates and amounts recorded here, at three times the RBI bank rate compounded monthly. Tie it back to the ledger before it goes into a tax audit report.',
  },
] as const;

/**
 * The limits, stated on the marketing page.
 *
 * Unusual, and deliberate: every one of these is something a sharp reader
 * would find in two minutes, and a product that tracks tax deadlines cannot
 * afford to be caught overclaiming.
 */
const Limits = () => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <section className="relative px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            What it does not do
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A tool that tells you when you owe a tax penalty has to be precise
            about its own limits.
          </p>
        </div>

        <dl className="divide-y divide-border border-t border-border">
          {LIMITS.map((l, i) => (
            <motion.div
              key={l.t}
              {...revealAt(i, !!shouldReduceMotion)}
              className="grid gap-2 py-6 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-8"
            >
              <dt className="text-base font-semibold text-foreground">{l.t}</dt>
              <dd className="text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                {l.d}
              </dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
};

/* ========================================================================= */

const TRACKER_ROWS = [
  { vendor: 'Sharma Steel Works', ref: 'PO-9001', amount: '₹18,40,000', state: 'Day 52 of 30', tone: 'risk' },
  { vendor: 'Kumar Furniture', ref: 'PO-9058', amount: '₹5,00,000 left', state: 'No written term, day 20 of 15', tone: 'risk' },
  { vendor: 'Rapid Office Supplies', ref: 'PO-9059', amount: '₹3,95,000', state: 'Objection open, clock stopped', tone: 'idle' },
  { vendor: 'Precision Fasteners', ref: 'PO-9053', amount: '₹6,20,000', state: 'Paid, day 12 of 30', tone: 'ok' },
] as const;

const Compliance = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative px-6 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <motion.div {...revealAt(0, !!shouldReduceMotion)}>
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            The deadline nobody sees until it is permanent
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Nothing happens on day 46. The firm finds out at audit, ten months
            later, when nothing can be done.
          </p>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
            The deadline is derived, not typed. &ldquo;Net 30&rdquo; gives thirty days.
            &ldquo;50% advance&rdquo; falls back to the statutory forty-five. No written
            payment term at all drops the limit to fifteen days, which is what
            the law actually says and what most SME buying runs on.
          </p>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
            It counts from the day you accepted the goods, not the day the
            invoice landed, because that is what the Act says. Object to a
            delivery in writing and the clock stops until the objection is
            removed.
          </p>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
            The remedy costs nothing. Pay on day 44 instead of day 46. The entire
            value is that somebody knew.
          </p>
        </motion.div>

        <motion.div {...revealAt(1, !!shouldReduceMotion)}>
          <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
            <div className="border-b border-border bg-sunken px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Section 43B(h) register</span>
            </div>
            <ul className="divide-y divide-border">
              {TRACKER_ROWS.map((row) => (
                <li key={row.ref} className="flex items-center gap-3 px-4 py-3">
                  {row.tone === 'risk' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-breach" aria-hidden="true" />
                  ) : row.tone === 'ok' ? (
                    <Check className="h-4 w-4 shrink-0 text-safe" aria-hidden="true" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 rounded-[var(--radius-inner)] border border-muted-foreground/40"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{row.vendor}</div>
                    <div className="figure text-label text-muted-foreground">{row.ref}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="figure text-sm font-semibold text-foreground">{row.amount}</div>
                    <div
                      className={`text-label ${
                        row.tone === 'risk' ? 'text-breach' : 'text-muted-foreground'
                      }`}
                    >
                      {row.state}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-4 py-2 text-label text-muted-foreground">
              Example data
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ========================================================================= */

const COVERAGE = [
  {
    who: 'Micro or small',
    what: 'Manufacturing or service',
    verdict: 'Clock applies',
    tone: 'watch',
    why: 'Forty-five days from acceptance, or fifteen where nothing was agreed in writing.',
  },
  {
    who: 'Micro or small',
    what: 'Trading',
    verdict: 'Out of scope',
    tone: 'safe',
    why: 'Retail and wholesale trade get priority-sector lending only. Office Memorandum 1/4(1)/2021-P&G Policy, 1 September 2021.',
  },
  {
    who: 'Medium',
    what: 'Any activity',
    verdict: 'Out of scope',
    tone: 'safe',
    why: 'Section 15 covers micro and small suppliers. Medium is not in it, however large the invoice.',
  },
] as const;

const Coverage = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative border-t border-border px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p className="text-label text-muted-foreground">Before the clock, the question nobody asks</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Half your suppliers are not covered at all
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A single yes-or-no MSME tick cannot answer this, so the register asks
            two questions instead: how big, and what do they actually do.
          </p>
        </div>

        <dl className="grid gap-px border border-border bg-border sm:grid-cols-3">
          {COVERAGE.map((c, i) => (
            <motion.div
              key={c.who + c.what}
              {...revealAt(i, !!shouldReduceMotion)}
              className="flex flex-col bg-surface p-6"
            >
              <dt>
                <span className="text-label text-muted-foreground">{c.who}</span>
                <span className="mt-1 block text-lg font-semibold text-foreground">{c.what}</span>
              </dt>
              <dd className="mt-5 flex flex-1 flex-col">
                <span
                  className={`text-label font-semibold ${
                    c.tone === 'watch' ? 'text-watch' : 'text-safe'
                  }`}
                >
                  {c.verdict}
                </span>
                <span className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {c.why}
                </span>
              </dd>
            </motion.div>
          ))}
        </dl>

        <motion.div
          {...revealAt(3, !!shouldReduceMotion)}
          className="mt-8 flex max-w-3xl gap-4 border-l-2 border-border pl-5"
        >
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            And a fourth state, which most tools skip. A supplier nobody has
            confirmed shows as unconfirmed, never as safe. The agent will email
            them and ask, then file the answer with the date it arrived.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

/* ========================================================================= */

const PAPERS = [
  {
    name: 'The register',
    when: 'Any day you want it',
    body: 'Every order, whether the clock applies and why, the date it started and from which event, days elapsed, and what is at risk. CSV for the accountant, PDF for the file.',
  },
  {
    name: 'Form MSME-1',
    when: '31 October and 30 April',
    body: 'The half-yearly MCA return, split into the four buckets the form asks for, with the PAN taken from each supplier’s GSTIN. A part payment sits as a balance outstanding, never as an invoice paid.',
  },
  {
    name: 'Clause 22 of Form 3CD',
    when: 'At the tax audit',
    body: 'Amount payable to micro and small suppliers, the amount disallowed, and the interest inadmissible under Section 23. Computed from these records, to be tied back to your ledger.',
  },
] as const;

const Paperwork = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="compliance" className="relative border-t border-border px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="text-label text-muted-foreground">What comes out of it</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              The three things your accountant asks for
            </h2>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Not a dashboard to screenshot. The working papers themselves, in the
              shape the filing wants them.
            </p>

            <motion.div
              {...revealAt(1, !!shouldReduceMotion)}
              className="mt-10 rounded-[var(--radius)] border border-border bg-surface p-5"
            >
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 shrink-0 text-watch" aria-hidden="true" />
                <span className="text-label font-semibold text-foreground">And it runs without you</span>
              </div>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                A job runs every morning. You get an email on day 30, again on day
                40, and again if it breaches, each one saying what the delay costs.
                Once per order per stage, so it never nags. It also nudges you
                before 31 March, when an unpaid deadline stops being recoverable.
              </p>
            </motion.div>
          </div>

          <dl className="divide-y divide-border border-y border-border">
            {PAPERS.map((p, i) => (
              <motion.div key={p.name} {...revealAt(i, !!shouldReduceMotion)} className="py-7">
                <dt className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-lg font-semibold text-foreground">{p.name}</span>
                  <span className="figure text-label text-muted-foreground">{p.when}</span>
                </dt>
                <dd className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {p.body}
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

/* ========================================================================= */

const TOOL_GROUPS = [
  {
    group: 'Suppliers',
    tools: ['Add a supplier', 'Add in bulk', 'List them', 'Remove one', 'Request an MSME declaration'],
  },
  {
    group: 'Sourcing',
    tools: ['Create an RFP', 'Read the quotes', 'Draft a negotiation', 'List negotiations'],
  },
  {
    group: 'Auctions',
    tools: ['Schedule one', 'View them', 'Watch one live'],
  },
  {
    group: 'Compliance',
    tools: ['Check 43B(h) exposure', 'Record delivery, acceptance or payment', 'Send a purchase order'],
  },
  {
    group: 'Documents',
    tools: ['Executive report', 'Set the company profile', 'Read it back', 'Send an email'],
  },
] as const;

const Tools = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative border-t border-border px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p className="text-label text-muted-foreground">Nineteen tools, one chat box</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Everything it can be asked to do
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            You type in plain English. It picks the tool, and every one of them
            writes to the same records the compliance pages read.
          </p>
        </div>

        <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_GROUPS.map((g, i) => (
            <motion.div key={g.group} {...revealAt(i, !!shouldReduceMotion)}>
              <dt className="border-b border-border pb-2 text-label font-semibold text-foreground">
                {g.group}
              </dt>
              <dd>
                <ul className="mt-3 space-y-1.5">
                  {g.tools.map((t) => (
                    <li key={t} className="text-sm leading-relaxed text-muted-foreground">
                      {t}
                    </li>
                  ))}
                </ul>
              </dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
};

/* ========================================================================= */

const INDUSTRIES = [
  {
    key: 'construction',
    name: 'Construction and infrastructure',
    lead: 'Site consumables, safety gear, structural steel',
    body:
      'Buying runs per site and per phase, against dozens of small local suppliers. This is where MSME exposure is highest, because almost every vendor on the list is one.',
    stat: 'Most exposed to the 45-day rule',
    icon: HardHat,
  },
  {
    key: 'manufacturing',
    name: 'Manufacturing',
    lead: 'Fasteners, tooling, raw material',
    body:
      'The same categories are bought again and again on annual contracts. A small difference in unit price compounds across the year, so comparing properly is worth more here than anywhere else.',
    stat: 'Repeat categories, compounding savings',
    icon: Factory,
  },
  {
    key: 'facilities',
    name: 'Facilities and hospitality',
    lead: 'Furniture, packaging, electrical fittings',
    body:
      'Fit-outs arrive in bursts. Twenty suppliers quote in a fortnight, then nothing for a quarter, so the work is never steady enough to justify a procurement team.',
    stat: 'Bursty demand, no standing team',
    icon: Building2,
  },
] as const;

const Industries = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || shouldReduceMotion) return;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    const id = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % INDUSTRIES.length);
    }, 5000);
    return () => clearInterval(id);
  }, [inView, shouldReduceMotion]);

  const active = INDUSTRIES[activeIdx];
  const ActiveIcon = active.icon;

  return (
    <section ref={sectionRef} id="industries" className="relative px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div {...revealAt(0, !!shouldReduceMotion)} className="max-w-2xl">
          <p className="text-label text-muted-foreground">Who buys this way</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Three industries, one broken loop
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            The pattern is the same everywhere: repeat purchases, mostly small
            suppliers, and nobody whose actual job is procurement.
          </p>
        </motion.div>

        <motion.div
          {...revealAt(1, !!shouldReduceMotion)}
          className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12"
        >
          <ul className="flex flex-col gap-2">
            {INDUSTRIES.map((ind, i) => {
              const Icon = ind.icon;
              const isActive = i === activeIdx;
              return (
                <li key={ind.key}>
                  <button
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-pressed={isActive}
                    className={`flex w-full items-start gap-3 rounded-[var(--radius)] border px-4 py-4 text-left transition-colors ${
                      isActive
                        ? 'border-foreground bg-sunken'
                        : 'border-border bg-surface hover:border-muted-foreground/50'
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {ind.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {ind.lead}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border bg-sunken px-5 py-3">
              <ActiveIcon className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">{active.name}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: dur.enter, ease: ease.standard }}
                className="px-5 py-6"
              >
                <p className="text-pretty text-base leading-relaxed text-foreground">
                  {active.body}
                </p>
                <p className="mt-5 text-label text-muted-foreground">{active.stat}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ========================================================================= */

const DemoVideo = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="demo" className="relative px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-2xl sm:mb-12">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Watch it run end to end
          </h2>
        </div>

        <motion.div
          {...revealAt(0, !!shouldReduceMotion)}
          className="overflow-hidden rounded-[var(--radius)] border border-border bg-sunken shadow-[var(--shot-halo)]"
        >
          <div className="relative aspect-video w-full">
            <iframe
              src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || "https://www.youtube-nocookie.com/embed/RJX_FI9l3qs?rel=0"}
              title="Procurix product demo"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ========================================================================= */

const CallToAction = () => {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative px-6 py-16 sm:py-24">
      <motion.div {...revealAt(0, !!shouldReduceMotion)} className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
          Sourcing, on autopilot from day one
        </h2>
        <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Sign in with Google and connect Gmail. That is the whole setup.
        </p>
        <div className="mt-10 flex justify-center">
          <PrimaryButton onClick={() => router.push('/login')} className="px-8 py-4 text-base">
            {CTA_LABEL}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </PrimaryButton>
        </div>
      </motion.div>
    </section>
  );
};

const Footer = () => (
  <footer className="border-t border-border px-6 py-14 sm:py-16">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center">
      <div className="flex items-center gap-2">
        <Image
          src="/procurixlogo_lightmode.png"
          alt="Procurix"
          width={28}
          height={28}
          className="object-contain"
          loading="lazy"
        />
        <span className="text-lg font-semibold tracking-tight text-foreground">Procurix</span>
      </div>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        From intake to award, on autopilot.
      </p>

      <div className="flex w-full flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
        <p>© 2026 Procurix. All rights reserved.</p>
        <div className="flex gap-6">
          <Link
            href="/privacy-policy"
            className="rounded-[var(--radius-inner)] transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Privacy policy
          </Link>
          <Link
            href="/terms-of-service"
            className="rounded-[var(--radius-inner)] transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Terms of service
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

/* Broadsheet everywhere, landing included.
   A near-black page halates for older eyes and washes out on a projector in a
   lit room, and the judging panel is exactly that audience. The hero
   photograph still supplies the dark, cinematic opening; the rest of the page
   is legible paper. Keynote remains available as the app's dark mode. */
ProcurixLanding.forcedTheme = 'light' as const;

export default function ProcurixLanding() {
  return (
    <>
      <Head>
        <title>Procurix, the AI procurement agent</title>
        <meta
          name="description"
          content="Procurix runs your sourcing end to end. It writes the RFP, runs the auction, negotiates the price, and makes sure you never miss an MSME payment deadline."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-[100dvh] overflow-x-clip bg-background font-sans text-foreground selection:bg-primary/20">
        <Navbar />
        <main>
          <Problem />
          <Proof />
          <Marquee items={BUY_ITEMS} className="border-y border-border py-4" />
          <Pipeline />
          <ProductShot />
          <Compliance />
          <Coverage />
          <Paperwork />
          <Tools />
          <Limits />
          <Industries />
          <DemoVideo />
          <CallToAction />
        </main>
        <Footer />
      </div>
    </>
  );
}
