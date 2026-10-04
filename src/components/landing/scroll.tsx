'use client';

/**
 * Scroll choreography primitives for the landing page.
 *
 * Built entirely on framer-motion's useScroll / useTransform / useSpring. No
 * GSAP, no ScrollTrigger, no Lenis, no WebGL: the rest of the app is Motion,
 * and mixing scroll libraries means two systems fighting over the same frames.
 *
 * Every primitive here:
 *   - animates transform and opacity only, never layout properties
 *   - drives values through MotionValues, never React state, so scrolling
 *     never re-renders the tree
 *   - collapses to a static, readable layout under prefers-reduced-motion
 */

import React, { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/** Scroll progress through an element, smoothed so scrubbing never feels brittle. */
function useSmoothProgress(
  ref: React.RefObject<HTMLElement | null>,
  offset: ['start end', 'end start'] | ['start start', 'end end'] | ['start end', 'end end']
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as never });
  return useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
}

/* ------------------------------------------------------------------------- */

/**
 * The signature move: a screenshot lying back in perspective that rises to face
 * the reader as it enters the viewport. Real depth from CSS 3D, no 3D library.
 */
export const TiltIn: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Starting lean in degrees. Larger reads more dramatic, 20 is about the limit. */
  degrees?: number;
}> = ({ children, className, degrees = 18 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const progress = useSmoothProgress(ref, ['start end', 'end end']);

  const rotateX = useTransform(progress, [0, 1], [degrees, 0]);
  const scale = useTransform(progress, [0, 1], [0.94, 1]);
  const y = useTransform(progress, [0, 1], [24, 0]);
  const opacity = useTransform(progress, [0, 0.35], [0, 1]);

  return (
    <div ref={ref} className={cn('[perspective:1600px]', className)}>
      <motion.div
        style={
          reduce
            ? undefined
            : { rotateX, scale, y, opacity, transformOrigin: '50% 100%', willChange: 'transform' }
        }
        className="[transform-style:preserve-3d]"
      >
        {children}
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */

/** Moves a layer against the scroll to create depth. Negative rate moves faster. */
export const Parallax: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Pixels of travel across the full pass. Positive drifts down, negative up. */
  distance?: number;
}> = ({ children, className, distance = -80 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const progress = useSmoothProgress(ref, ['start end', 'end start']);
  const y = useTransform(progress, [0, 1], [distance * -0.5, distance * 0.5]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y, willChange: 'transform' }}>{children}</motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------- */

/**
 * Cards that pin at the top of the viewport and physically stack, each one
 * shrinking and dimming as the next arrives over it.
 */
export const StickyStack: React.FC<{ children: React.ReactNode[]; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('relative', className)}>
    {children.map((child, i) => (
      <StackCard key={i} index={i} total={children.length}>
        {child}
      </StackCard>
    ))}
  </div>
);

const StackCard: React.FC<{ children: React.ReactNode; index: number; total: number }> = ({
  children,
  index,
  total,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });

  const isLast = index === total - 1;
  const scale = useTransform(progress, [0, 1], [1, isLast ? 1 : 0.94]);
  const opacity = useTransform(progress, [0, 1], [1, isLast ? 1 : 0.45]);

  return (
    <div
      ref={ref}
      // Each card offsets a little further down so the stack edge stays visible.
      style={{ top: `calc(6rem + ${index * 0.75}rem)` }}
      className="sticky mb-6"
    >
      <motion.div
        style={reduce ? undefined : { scale, opacity, transformOrigin: '50% 0%', willChange: 'transform' }}
      >
        {children}
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */

/**
 * Full-bleed photograph that drifts and scales slowly behind a scrim, with
 * content sitting on top. The scrim is what keeps the type readable, so it is
 * not optional decoration.
 */
export const ScrimPhoto: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
  children: React.ReactNode;
  className?: string;
  priority?: boolean;
}> = ({ src, alt, width, height, children, className, priority }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const progress = useSmoothProgress(ref, ['start end', 'end start']);
  const scale = useTransform(progress, [0, 1], [1.12, 1]);
  const y = useTransform(progress, [0, 1], [-30, 30]);

  return (
    <section ref={ref} className={cn('relative isolate overflow-hidden', className)}>
      <motion.div
        aria-hidden="true"
        style={reduce ? undefined : { scale, y, willChange: 'transform' }}
        className="absolute inset-0 -z-10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </motion.div>
      {/* Scrim. Carries the type contrast, in both themes. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,hsl(220_12%_9%/0.82),hsl(220_12%_9%/0.68)_45%,hsl(220_12%_9%/0.9))]"
      />
      {children}
    </section>
  );
};

/* ------------------------------------------------------------------------- */

/** One marquee per page, and this is it. Pauses under reduced motion. */
export const Marquee: React.FC<{ items: string[]; className?: string }> = ({ items, className }) => {
  const reduce = useReducedMotion();
  const doubled = [...items, ...items];

  return (
    <div className={cn('relative overflow-hidden', className)} aria-hidden="true">
      <motion.div
        className="flex w-max gap-10 whitespace-nowrap"
        animate={reduce ? undefined : { x: ['0%', '-50%'] }}
        transition={reduce ? undefined : { duration: 38, ease: 'linear', repeat: Infinity }}
        style={{ willChange: 'transform' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="text-label text-muted-foreground">
            {item}
          </span>
        ))}
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(to_right,hsl(var(--background)),transparent)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-[linear-gradient(to_left,hsl(var(--background)),transparent)]" />
    </div>
  );
};

/* ------------------------------------------------------------------------- */

/**
 * A screenshot in a restrained device frame. The frame exists so a light
 * screenshot has an edge against a light page, not as decoration.
 */
export const ShotFrame: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}> = ({ src, alt, width, height, className, priority }) => (
  <figure
    className={cn(
      'overflow-hidden rounded-[var(--radius)] border border-border bg-sunken',
      'shadow-[var(--shot-halo)]',
      className
    )}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className="block h-auto w-full"
    />
  </figure>
);

/* ------------------------------------------------------------------------- */

/**
 * A stage that pins to the viewport while scroll walks through a fixed set of
 * steps, the way a product page narrates a sequence. Every scroll position
 * inside the track has content, which is what stops a pinned section from
 * reading as blank space.
 *
 * The step index is the only thing held in React state. It changes once per
 * step, not once per frame, so this stays cheap.
 */
export function usePinnedSequence(
  ref: React.RefObject<HTMLElement | null>,
  steps: number
) {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const [index, setIndex] = React.useState(0);

  useMotionValueEvent(progress, 'change', (v) => {
    // Bias slightly forward so a step lands before its scroll block ends.
    const next = Math.min(steps - 1, Math.max(0, Math.floor(v * steps + 0.15)));
    setIndex((cur) => (cur === next ? cur : next));
  });

  return { progress, index };
}

/** Track wrapper. Height is derived from the step count so dwell time is even. */
export const PinnedStage: React.FC<{
  trackRef: React.RefObject<HTMLDivElement | null>;
  steps: number;
  children: React.ReactNode;
  className?: string;
}> = ({ trackRef, steps, children, className }) => (
  <div
    ref={trackRef}
    style={{ height: `${steps * 55 + 30}vh` }}
    className={cn('relative', className)}
  >
    <div className="sticky top-0 flex h-[100dvh] flex-col justify-center overflow-hidden pt-16 sm:pt-20">
      {children}
    </div>
  </div>
);
