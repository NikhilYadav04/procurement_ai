import React, { useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';

/**
 * Static depth layer. The grid only renders in dark mode: on the light paper
 * ground the ambient motion/decoration budget is zero (design spec section
 * 4, rule 10). No blurred colour orbs here any more, those read as "glow"
 * decoration and the spec bans it outside a single drifting radial that
 * nothing in this file currently needs.
 */
export const Backdrop: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}
  >
    <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(to_right,hsl(var(--foreground)/0.035)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000_35%,transparent_100%)]" />
  </div>
);

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  raised?: boolean;
  interactive?: boolean;
};

export const Panel: React.FC<PanelProps> = ({
  raised = false,
  interactive = false,
  className,
  children,
  onDrag,
  onDragStart,
  onDragEnd,
  onAnimationStart,
  onAnimationEnd,
  onAnimationIteration,
  ...props
}) => {
  const shouldReduceMotion = useReducedMotion();
  const classes = cn('panel', raised && 'panel-raised', interactive && 'panel-interactive', className);

  if (!interactive) {
    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }

  // Hover lift is a transform, so it goes through a spring per the motion
  // spec, not a CSS duration. The border-colour change on hover stays in the
  // .panel-interactive CSS rule since colour changes take a duration, not a
  // spring.
  return (
    <motion.div
      className={classes}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={spring.ui}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * Subtle hover glow for a clickable card. Retinted from the retired --glow
 * token to --primary (indigo only appears where the user can click, and a
 * spotlight card is always a click target), kept faint.
 */
/**
 * Feeds pointer position to the .spotlight class as CSS variables.
 * Writes straight to style, never to React state, so moving the cursor never
 * re-renders the tree.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);
  return { ref, onPointerMove };
}

export const Spotlight: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }
> = ({ className, children, ...props }) => (
  <div className={cn('group relative', className)} {...props}>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-px rounded-[inherit] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.08),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
    />
    <div className="relative h-full">{children}</div>
  </div>
);

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  className?: string;
}> = ({ label, value, accent = false, className }) => (
  <div className={cn('panel px-4 py-3', className)}>
    <div className="text-label text-muted-foreground">{label}</div>
    <div className={cn('figure mt-1 text-lg text-foreground', accent ? 'font-semibold' : 'font-medium')}>
      {value}
    </div>
  </div>
);

const CHIP_TONES = {
  safe: 'border-safe/30 bg-safe/12 text-safe',
  watch: 'border-watch/30 bg-watch/12 text-watch',
  breach: 'border-breach/40 bg-breach/15 text-breach',
  neutral: 'border-border bg-secondary text-muted-foreground',
  // Deprecated aliases kept so existing call sites (outside this file's
  // scope in this pass) keep compiling while they migrate to the
  // compliance-status names above. Same classes, new names, same colours.
  emerald: 'border-safe/30 bg-safe/12 text-safe',
  amber: 'border-watch/30 bg-watch/12 text-watch',
  red: 'border-breach/40 bg-breach/15 text-breach',
} as const;

export const Chip: React.FC<{
  tone?: keyof typeof CHIP_TONES;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'neutral', icon, children, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-[var(--radius-inner)] border px-1.5 py-0.5 text-label',
      CHIP_TONES[tone],
      className
    )}
  >
    {icon && <span aria-hidden="true">{icon}</span>}
    {children}
  </span>
);

/**
 * Nominal series, one hue. Bar length already encodes the value, so all
 * bars take series-1, varying only in opacity, per the chart rules (status
 * colours are never series colours, and a value is never used to pick a
 * hue).
 */
export const ScoreBars: React.FC<{ scores: number[]; className?: string }> = ({
  scores,
  className,
}) => (
  <div className={cn('flex items-end gap-1', className)} aria-hidden="true">
    {scores.map((s, i) => {
      const clamped = Math.max(0.15, Math.min(1, s));
      return (
        <span
          key={i}
          style={{ height: `${clamped * 22}px`, opacity: 0.35 + clamped * 0.65 }}
          className="w-1.5 rounded-[var(--radius-inner)] bg-series-1"
        />
      );
    })}
  </div>
);
