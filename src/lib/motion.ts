/**
 * Motion tokens. Every animated component imports from here.
 *
 * The rule: springs for anything that changes position or size, durations only
 * for opacity and colour. That distinction is what makes the motion feel
 * physical rather than timed.
 */

export const spring = {
  /** Buttons, chips, toggles, icon affordances. */
  ui: { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 },
  /** Panels, sheets, split pane, shared-element morphs. */
  surface: { type: 'spring', stiffness: 260, damping: 30, mass: 1.0 },
  /** FLIP list re-ranking. */
  reorder: { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 },
} as const

export const ease = {
  standard: [0.32, 0.72, 0, 1],
  exit: [0.4, 0, 1, 1],
} as const

export const dur = { enter: 0.14, exit: 0.1 } as const

/** 32ms. Cap staggered entries at 6 items, then batch the remainder. */
export const STAGGER = 0.032

export const press = { scale: 0.98 }

/** Standard list-item entry. Index drives the stagger, capped at 6. */
export const enterItem = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: dur.enter,
    ease: ease.standard,
    delay: Math.min(i, 5) * STAGGER,
  },
})
