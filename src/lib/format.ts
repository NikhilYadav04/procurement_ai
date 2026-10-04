/**
 * All number and date formatting goes through here.
 *
 * en-IN gives lakh/crore grouping, which is what an Indian buyer reads:
 * 2450000 renders as "₹24,50,000", not "₹2,450,000".
 */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const plain = new Intl.NumberFormat('en-IN')

const pct = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export const formatINR = (n: number) => inr.format(n)

/** For stat tiles where space is tight: "₹24.5L". */
export const formatINRCompact = (n: number) => inrCompact.format(n)

export const formatNumber = (n: number) => plain.format(n)

/** Takes a fraction, not a percentage: 0.132 renders as "13.2%". */
export const formatPercent = (n: number) => pct.format(n)

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d))

export const formatDate = (d: Date | string | number) => dateFmt.format(toDate(d))

export const formatDateTime = (d: Date | string | number) => dateTimeFmt.format(toDate(d))
