import { checkGstin } from '@/lib/gstVerify';
import { financialYear, isSettled, type ComplianceRow } from '@/lib/msmeCompliance';

export const MSME1_THRESHOLD_DAYS = 45;

export type Msme1Bucket =
  | 'paid_within_45'
  | 'paid_after_45'
  | 'outstanding_under_45'
  | 'outstanding_over_45';

export const MSME1_BUCKET_LABELS: Record<Msme1Bucket, string> = {
  paid_within_45: 'Paid within 45 days',
  paid_after_45: 'Paid after 45 days',
  outstanding_under_45: 'Outstanding, 45 days not yet over',
  outstanding_over_45: 'Outstanding beyond 45 days',
};

export interface HalfYear {
  label: string;
  period: 'apr_sep' | 'oct_mar';
  start: string;
  end: string;
  filing_due: string;
}

export interface Msme1Row {
  po_number: string;
  vendor_name: string | null;
  vendor_email: string;
  udyam_number: string | null;
  pan: string | null;
  amount: number;
  clock_start: string | null;
  days_taken: number | null;
  paid_at: string | null;
  bucket: Msme1Bucket;
}

export interface Msme1Return {
  half_year: HalfYear;
  rows: Msme1Row[];
  buckets: Record<Msme1Bucket, Msme1Row[]>;
  totals: Record<Msme1Bucket, number>;
  amount_outstanding_over_45: number;
  filing_required: boolean;
  started: boolean;
  note: string;
}

export interface Clause22 {
  financial_year: string;
  as_at: string;
  amount_payable_to_mse: number;
  amount_disallowed: number;
  interest_computed: number;
  orders_payable: number;
  orders_disallowed: number;
  note: string;
}

export type Msme1Input = ComplianceRow & {
  gstin?: string | null;
  vendor_gstin?: string | null;
  udyam_number?: string | null;
};

function daysBetween(from: Date | string, to: Date | string): number {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000);
}

function panFrom(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const check = checkGstin(gstin);
  return check.valid ? check.pan ?? null : null;
}

export function halfYearFor(date: Date | string): HalfYear {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();

  if (month >= 3 && month <= 8) {
    return {
      label: `April to September ${year}`,
      period: 'apr_sep',
      start: `${year}-04-01`,
      end: `${year}-09-30`,
      filing_due: `${year}-10-31`,
    };
  }

  const startYear = month >= 9 ? year : year - 1;
  return {
    label: `October ${startYear} to March ${startYear + 1}`,
    period: 'oct_mar',
    start: `${startYear}-10-01`,
    end: `${startYear + 1}-03-31`,
    filing_due: `${startYear + 1}-04-30`,
  };
}

export function halfYearsOfFy(date: Date | string): HalfYear[] {
  const fy = financialYear(date);
  const year = Number(fy.start.slice(0, 4));
  return [halfYearFor(`${year}-06-01`), halfYearFor(`${year}-12-01`)];
}

function emptyBuckets(): Record<Msme1Bucket, Msme1Row[]> {
  return {
    paid_within_45: [],
    paid_after_45: [],
    outstanding_under_45: [],
    outstanding_over_45: [],
  };
}

export function msme1Return(
  rows: Msme1Input[],
  half: HalfYear,
  now: Date = new Date()
): Msme1Return {
  const buckets = emptyBuckets();
  const asAt = new Date(now) < new Date(half.end) ? new Date(now) : new Date(half.end);
  const notStarted = daysBetween(now, half.start) > 0;

  if (notStarted) {
    return {
      half_year: half,
      rows: [],
      buckets,
      totals: { paid_within_45: 0, paid_after_45: 0, outstanding_under_45: 0, outstanding_over_45: 0 },
      amount_outstanding_over_45: 0,
      filing_required: false,
      started: false,
      note: `This half-year begins on ${half.start} and has not started yet. It will be filed by ${half.filing_due}.`,
    };
  }

  for (const row of rows) {
    if (row.covered !== true) continue;
    if (!row.clock_start) continue;
    if (daysBetween(row.clock_start, half.end) < 0) continue;

    const settled = isSettled(row);

    const paidInPeriod =
      settled &&
      daysBetween(half.start, row.paid_at!) >= 0 &&
      daysBetween(row.paid_at!, half.end) >= 0;

    const stillOwingAtEnd = !settled || daysBetween(half.end, row.paid_at!) > 0;

    let bucket: Msme1Bucket;
    let days: number;
    let amount: number;

    if (paidInPeriod) {
      days = daysBetween(row.clock_start, row.paid_at!);
      bucket = days > MSME1_THRESHOLD_DAYS ? 'paid_after_45' : 'paid_within_45';
      amount = Number(row.total_amount);
    } else if (stillOwingAtEnd && row.outstanding > 0) {
      days = daysBetween(row.clock_start, asAt);
      bucket = days > MSME1_THRESHOLD_DAYS ? 'outstanding_over_45' : 'outstanding_under_45';
      amount = row.outstanding;
    } else {
      continue;
    }

    buckets[bucket].push({
      po_number: row.po_number,
      vendor_name: row.vendor_name,
      vendor_email: row.vendor_email,
      udyam_number: row.udyam_number ?? null,
      pan: panFrom(row.vendor_gstin ?? row.gstin),
      amount,
      clock_start: row.clock_start,
      days_taken: days,
      paid_at: row.paid_at,
      bucket,
    });
  }

  const totals = {
    paid_within_45: buckets.paid_within_45.reduce((t, r) => t + r.amount, 0),
    paid_after_45: buckets.paid_after_45.reduce((t, r) => t + r.amount, 0),
    outstanding_under_45: buckets.outstanding_under_45.reduce((t, r) => t + r.amount, 0),
    outstanding_over_45: buckets.outstanding_over_45.reduce((t, r) => t + r.amount, 0),
  };

  const filingRequired = buckets.outstanding_over_45.length > 0;

  return {
    half_year: half,
    rows: [
      ...buckets.outstanding_over_45,
      ...buckets.outstanding_under_45,
      ...buckets.paid_after_45,
      ...buckets.paid_within_45,
    ],
    buckets,
    totals,
    amount_outstanding_over_45: totals.outstanding_over_45,
    filing_required: filingRequired,
    started: true,
    note: filingRequired
      ? `${buckets.outstanding_over_45.length} supplier payment(s) were outstanding beyond ${MSME1_THRESHOLD_DAYS} days at the end of this half-year, so Form MSME-1 is due by ${half.filing_due}.`
      : `Nothing was outstanding beyond ${MSME1_THRESHOLD_DAYS} days at the end of this half-year. There is no nil return, so no filing is required.`,
  };
}

export function clause22(
  rows: Msme1Input[],
  fyDate: Date | string,
  now: Date = new Date()
): Clause22 {
  const fy = financialYear(fyDate);
  const asAt = new Date(now) < new Date(fy.end) ? new Date(now) : new Date(fy.end);

  let payable = 0;
  let disallowed = 0;
  let interest = 0;
  let ordersPayable = 0;
  let ordersDisallowed = 0;

  for (const row of rows) {
    if (row.covered !== true) continue;
    if (!row.clock_start) continue;
    if (daysBetween(row.clock_start, fy.end) < 0) continue;

    const settledBeforeCutoff = isSettled(row) && daysBetween(row.paid_at!, asAt) >= 0;
    if (settledBeforeCutoff || row.outstanding <= 0) continue;

    payable += row.outstanding;
    ordersPayable++;

    const elapsed = daysBetween(row.clock_start, asAt);
    if (elapsed > row.deadline_days) {
      disallowed += row.outstanding;
      interest += row.interest_accrued;
      ordersDisallowed++;
    }
  }

  return {
    financial_year: fy.label,
    as_at: asAt.toISOString().slice(0, 10),
    amount_payable_to_mse: payable,
    amount_disallowed: disallowed,
    interest_computed: Math.round(interest),
    orders_payable: ordersPayable,
    orders_disallowed: ordersDisallowed,
    note: 'Interest is computed under Section 16 of the MSMED Act and is inadmissible under Section 23. It is calculated from these records, not read from your books, so confirm it against the ledger before it goes into the tax audit report.',
  };
}

export function buyerIsCompany(companyGstin: string | null | undefined): boolean | null {
  if (!companyGstin) return null;
  const check = checkGstin(companyGstin);
  if (!check.valid) return null;
  return check.entity_type === 'Company';
}

export function msme1Applicability(companyGstin: string | null | undefined): string {
  const isCompany = buyerIsCompany(companyGstin);

  if (isCompany === true) {
    return 'Form MSME-1 applies to you. It is filed under the Companies Act, and your GSTIN shows a company.';
  }

  if (isCompany === false) {
    return 'Form MSME-1 is filed under the Companies Act and applies to companies only. Your GSTIN does not show a company, so this is for reference. The 45-day payment rule itself still applies to you.';
  }

  return 'Form MSME-1 applies to companies only. Add your company GSTIN in settings and this page will tell you whether it applies to you.';
}
