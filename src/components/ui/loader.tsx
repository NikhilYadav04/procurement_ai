import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Small inline loading indicator (send button in flight, an action in
 * progress). No props, no styled-components (that was the only
 * styled-components usage in an otherwise Tailwind codebase, plus a
 * hue-rotate keyframe that had nothing to do with any token). Token-driven,
 * respects prefers-reduced-motion by freezing instead of spinning forever.
 *
 * Default export and zero-argument call signature kept exactly as before so
 * existing call sites (ChatComposer, dashboard, index, welcome) keep
 * compiling unchanged.
 */
const Loader = () => {
  return (
    <span role="status" className="inline-flex h-8 w-8 items-center justify-center">
      {/* 16px box, 8px (--radius-inner) corner radius: on a square this
          size that resolves to a true circle, same as the locked radius
          system already does for the button and slider thumb, so this
          spinner ring does not need a rounded-full exception. */}
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-[var(--radius-inner)] border-2 border-border border-t-primary motion-reduce:animate-none"
      />
      <span className="sr-only">Loading…</span>
    </span>
  );
};

export default Loader;

type SkeletonShape =
  | { kind: 'text'; lines?: number; className?: string }
  | { kind: 'circle'; size?: number; className?: string }
  | { kind: 'rect'; className?: string; height?: string }
  | { kind: 'card'; className?: string };

/**
 * Layout-matched loading placeholder. Pass the shape of the content that
 * will land in this spot so the page does not jump when it arrives.
 */
export function Skeleton(props: SkeletonShape) {
  const pulse = 'animate-pulse motion-reduce:animate-none bg-sunken';

  if (props.kind === 'text') {
    const lines = props.lines ?? 1;
    return (
      <div aria-hidden="true" className={cn('space-y-2', props.className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 rounded-[var(--radius-inner)]',
              pulse,
              i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'
            )}
          />
        ))}
      </div>
    );
  }

  if (props.kind === 'circle') {
    const size = props.size ?? 40;
    return (
      <div
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn('rounded-full', pulse, props.className)}
      />
    );
  }

  if (props.kind === 'card') {
    return (
      <div aria-hidden="true" className={cn('panel space-y-3 p-4', props.className)}>
        <div className={cn('h-4 w-1/3 rounded-[var(--radius-inner)]', pulse)} />
        <div className={cn('h-3 w-full rounded-[var(--radius-inner)]', pulse)} />
        <div className={cn('h-3 w-2/3 rounded-[var(--radius-inner)]', pulse)} />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={props.height ? { height: props.height } : undefined}
      className={cn('h-24 w-full rounded-[var(--radius-inner)]', pulse, props.className)}
    />
  );
}
