export const STATUTORY_CAP_DAYS = 45;
export const NO_AGREEMENT_DAYS = 15;
export const WARN_AT_DAYS = 30;
export const ESCALATE_AT_DAYS = 40;

export const DEFAULT_TAX_RATE_PCT = 25;
export const DEFAULT_BANK_RATE_PCT = 6.5;
export const MSMED_INTEREST_MULTIPLE = 3;

export type ComplianceState = 'safe' | 'due_soon' | 'urgent' | 'breached' | 'paid' | 'not_applicable';
export type TermBasis = 'written' | 'no_written_term' | 'immediate';
export type ClockBasis = 'acceptance' | 'objection_resolved' | 'delivery' | 'invoice';
export type DeductionYear = 'accrual_year' | 'year_of_payment';
export type MsmeCategory = 'micro' | 'small' | 'medium' | 'not_registered' | 'unknown';
export type UdyamActivity = 'manufacturing' | 'service' | 'trading' | 'unknown';
export type MsmeSource = 'declaration' | 'registry' | 'self_reported' | 'unknown';

export interface Rates {
  tax_rate_pct: number;
  bank_rate_pct: number;
}

export const DEFAULT_RATES: Rates = {
  tax_rate_pct: DEFAULT_TAX_RATE_PCT,
  bank_rate_pct: DEFAULT_BANK_RATE_PCT,
};

export interface VendorCoverage {
  is_msme?: boolean | null;
  msme_category?: string | null;
  udyam_activity?: string | null;
}

export interface Coverage {
  covered: boolean | null;
  category: MsmeCategory;
  activity: UdyamActivity;
  reason: string;
}

export function normaliseCategory(value: string | null | undefined): MsmeCategory {
  const v = (value || '').trim().toLowerCase();
  if (v === 'micro') return 'micro';
  if (v === 'small') return 'small';
  if (v === 'medium') return 'medium';
  if (v === 'not_registered' || v === 'unregistered' || v === 'none') return 'not_registered';
  return 'unknown';
}

export function normaliseActivity(value: string | null | undefined): UdyamActivity {
  const v = (value || '').trim().toLowerCase();
  if (v === 'manufacturing' || v === 'manufacture') return 'manufacturing';
  if (v === 'service' || v === 'services') return 'service';
  if (v === 'trading' || v === 'trade' || v === 'retail' || v === 'wholesale') return 'trading';
  return 'unknown';
}

export function coverageFor(vendor: VendorCoverage): Coverage {
  const category = normaliseCategory(vendor.msme_category);
  const activity = normaliseActivity(vendor.udyam_activity);

  if (activity === 'trading') {
    return {
      covered: false,
      category,
      activity,
      reason:
        'The Udyam registration is for trading. Retail and wholesale trade get priority-sector lending only, so the delayed-payment provisions do not apply. Office Memorandum 1/4(1)/2021-P&G Policy, 1 September 2021.',
    };
  }

  if (category === 'medium') {
    return {
      covered: false,
      category,
      activity,
      reason: 'A medium enterprise. Section 15 of the MSMED Act covers micro and small suppliers only.',
    };
  }

  if (category === 'not_registered') {
    return {
      covered: false,
      category,
      activity,
      reason: 'Not registered under Udyam, so the delayed-payment provisions do not apply.',
    };
  }

  if (category === 'micro' || category === 'small') {
    return {
      covered: true,
      category,
      activity,
      reason:
        activity === 'unknown'
          ? `A ${category} enterprise, so the payment window applies. The Udyam activity is not recorded; confirm it is not trading, which would take them out of scope.`
          : `A ${category} enterprise in ${activity}, so the payment window applies.`,
    };
  }

  if (vendor.is_msme === true) {
    return {
      covered: true,
      category,
      activity,
      reason:
        'Recorded as a micro or small enterprise, but without the Udyam category. Confirm whether they are micro, small or medium, because medium is out of scope.',
    };
  }

  if (vendor.is_msme === false) {
    return {
      covered: false,
      category,
      activity,
      reason: 'This vendor is not a registered micro or small enterprise, so the 45-day rule does not apply.',
    };
  }

  return {
    covered: null,
    category,
    activity,
    reason:
      'It is not recorded whether this vendor is a Udyam-registered micro or small enterprise. Confirm with them, because if they are, the 45-day rule applies and the clock is already running.',
  };
}

export interface CompliancePo {
  id: string;
  po_number: string;
  vendor_name: string | null;
  vendor_email: string;
  vendor_is_msme: boolean | null;
  vendor_msme_category?: string | null;
  vendor_udyam_activity?: string | null;
  total_amount: number;
  payment_terms: string | null;
  invoice_received_at: string | null;
  paid_at: string | null;
  status: string;
  goods_accepted_at?: string | null;
  delivered_at?: string | null;
  amount_paid?: number | null;
  objection_raised_at?: string | null;
  objection_resolved_at?: string | null;
}

export interface TaxExposure {
  outstanding: number;
  tax_deferred: number;
  interest_accrued: number;
  total_cost: number;
  months_overdue: number;
  tax_rate_pct: number;
  interest_rate_pct: number;
}

export interface ComplianceRow extends CompliancePo {
  state: ComplianceState;
  covered: boolean | null;
  coverage_reason: string;
  msme_category: MsmeCategory;
  udyam_activity: UdyamActivity;
  deadline_days: number;
  term_basis: TermBasis;
  clock_start: string | null;
  clock_basis: ClockBasis | null;
  days_elapsed: number | null;
  days_left: number | null;
  due_date: string | null;
  outstanding: number;
  outstanding_now: number;
  amount_at_risk: number;
  tax_deferred: number;
  interest_accrued: number;
  total_cost: number;
  expense_fy: string;
  deduction_year: DeductionYear;
  days_to_fy_end: number;
  reason: string;
}

export function termsFor(paymentTerms: string | null): { days: number; basis: TermBasis } {
  const terms = (paymentTerms || '').trim();
  if (!terms) return { days: NO_AGREEMENT_DAYS, basis: 'no_written_term' };

  const net = terms.match(/net\s*(\d{1,3})/i);
  if (net) return { days: Math.min(parseInt(net[1], 10), STATUTORY_CAP_DAYS), basis: 'written' };

  const days = terms.match(/(\d{1,3})\s*days?/i);
  if (days) return { days: Math.min(parseInt(days[1], 10), STATUTORY_CAP_DAYS), basis: 'written' };

  if (/advance|upfront|immediate|on\s*delivery|against\s*delivery|\bcod\b/i.test(terms)) {
    return { days: NO_AGREEMENT_DAYS, basis: 'immediate' };
  }

  return { days: NO_AGREEMENT_DAYS, basis: 'no_written_term' };
}

export function agreedTermDays(paymentTerms: string | null): number {
  return termsFor(paymentTerms).days;
}

function daysBetween(from: Date | string, to: Date | string): number {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000);
}

export function financialYear(date: Date | string): { label: string; start: string; end: string } {
  const d = new Date(date);
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    label: `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}`,
    start: `${year}-04-01`,
    end: `${year + 1}-03-31`,
  };
}

export function taxExposure(
  outstanding: number,
  daysOverdue: number,
  rates: Rates = DEFAULT_RATES
): TaxExposure {
  const amount = Math.max(0, Number(outstanding) || 0);
  const annualPct = MSMED_INTEREST_MULTIPLE * rates.bank_rate_pct;
  const months = daysOverdue > 0 ? daysOverdue / 30 : 0;
  const monthlyRate = annualPct / 100 / 12;

  const taxDeferred = amount * (rates.tax_rate_pct / 100);
  const interest = months > 0 ? amount * (Math.pow(1 + monthlyRate, months) - 1) : 0;

  return {
    outstanding: amount,
    tax_deferred: Math.round(taxDeferred),
    interest_accrued: Math.round(interest),
    total_cost: Math.round(taxDeferred + interest),
    months_overdue: Math.round(months * 100) / 100,
    tax_rate_pct: rates.tax_rate_pct,
    interest_rate_pct: annualPct,
  };
}

function clockStartFor(po: CompliancePo): { at: string | null; basis: ClockBasis | null; objected: boolean } {
  if (po.objection_raised_at && !po.objection_resolved_at) {
    return { at: null, basis: null, objected: true };
  }

  if (po.goods_accepted_at) return { at: po.goods_accepted_at, basis: 'acceptance', objected: false };
  if (po.objection_resolved_at) return { at: po.objection_resolved_at, basis: 'objection_resolved', objected: false };
  if (po.delivered_at) return { at: po.delivered_at, basis: 'delivery', objected: false };
  if (po.invoice_received_at) return { at: po.invoice_received_at, basis: 'invoice', objected: false };
  return { at: null, basis: null, objected: false };
}

function outstandingFor(po: CompliancePo): number {
  const total = Number(po.total_amount) || 0;
  const paid = Number(po.amount_paid ?? 0) || 0;
  return Math.max(0, total - paid);
}

export function isSettled(po: { paid_at?: string | null; amount_paid?: number | null; total_amount?: number | null }): boolean {
  if (!po.paid_at) return false;
  if (po.amount_paid == null) return true;
  return Math.max(0, (Number(po.total_amount) || 0) - (Number(po.amount_paid) || 0)) <= 0;
}

export function assessPo(
  po: CompliancePo,
  now: Date = new Date(),
  rates: Rates = DEFAULT_RATES
): ComplianceRow {
  const { days: deadlineDays, basis: termBasis } = termsFor(po.payment_terms);
  const clock = clockStartFor(po);
  const outstanding = outstandingFor(po);
  const outstandingNow = isSettled(po) ? 0 : outstanding;
  const fy = financialYear(clock.at || now);
  const daysToFyEnd = daysBetween(now, fy.end);

  const coverage = coverageFor({
    is_msme: po.vendor_is_msme,
    msme_category: po.vendor_msme_category,
    udyam_activity: po.vendor_udyam_activity,
  });

  const base: ComplianceRow = {
    ...po,
    state: 'not_applicable',
    covered: coverage.covered,
    coverage_reason: coverage.reason,
    msme_category: coverage.category,
    udyam_activity: coverage.activity,
    deadline_days: deadlineDays,
    term_basis: termBasis,
    clock_start: clock.at,
    clock_basis: clock.basis,
    days_elapsed: null,
    days_left: null,
    due_date: null,
    outstanding,
    outstanding_now: outstandingNow,
    amount_at_risk: 0,
    tax_deferred: 0,
    interest_accrued: 0,
    total_cost: 0,
    expense_fy: fy.label,
    deduction_year: 'accrual_year',
    days_to_fy_end: daysToFyEnd,
    reason: '',
  };

  if (coverage.covered !== true) {
    return { ...base, reason: coverage.reason };
  }

  const settled = isSettled(po);

  if (settled) {
    const elapsed = clock.at ? daysBetween(clock.at, po.paid_at!) : null;
    const late = elapsed !== null && elapsed > deadlineDays;
    const overdueDays = late ? elapsed! - deadlineDays : 0;
    const exposure = taxExposure(Number(po.total_amount), overdueDays, rates);
    return {
      ...base,
      state: 'paid',
      days_elapsed: elapsed,
      deduction_year: late ? 'year_of_payment' : 'accrual_year',
      interest_accrued: late ? exposure.interest_accrued : 0,
      total_cost: late ? exposure.interest_accrued : 0,
      reason: late
        ? `Paid after ${elapsed} days, past the ${deadlineDays}-day limit. The deduction moves to ${financialYear(po.paid_at!).label}, and interest of ${formatShort(exposure.interest_accrued)} is owed under Section 16 of the MSMED Act.`
        : `Paid${elapsed !== null ? ` in ${elapsed} days` : ''}. Within the limit, so the deduction stays in ${fy.label}.`,
    };
  }

  if (!clock.at) {
    return {
      ...base,
      reason: clock.objected
        ? 'An objection to the goods was raised in writing and has not been resolved, so acceptance has not occurred and the payment clock has not started. Section 2(b) of the MSMED Act starts it on the day the objection is removed.'
        : 'Nothing delivered or invoiced yet, so the clock has not started.',
    };
  }

  const elapsed = daysBetween(clock.at, now);
  const left = deadlineDays - elapsed;

  const due = new Date(clock.at);
  due.setDate(due.getDate() + deadlineDays);
  const dueDate = due.toISOString().slice(0, 10);

  const overdueDays = left < 0 ? Math.abs(left) : 0;
  const exposure = taxExposure(outstanding, overdueDays, rates);

  const termNote =
    termBasis === 'no_written_term'
      ? ` No written credit term was recorded, so the limit is ${NO_AGREEMENT_DAYS} days, not ${STATUTORY_CAP_DAYS}.`
      : termBasis === 'immediate'
      ? ` The terms say payment on or before delivery, so the limit is ${NO_AGREEMENT_DAYS} days, not ${STATUTORY_CAP_DAYS}.`
      : '';

  const clockNote =
    clock.basis === 'acceptance'
      ? ' The clock runs from acceptance of the goods, not the invoice date.'
      : clock.basis === 'objection_resolved'
      ? ' An objection was raised and then removed. Section 2(b) of the MSMED Act treats the day it was removed as the day of acceptance, so the clock runs from there.'
      : clock.basis === 'delivery'
      ? ' The clock runs from delivery, not the invoice date.'
      : '';

  let state: ComplianceState;
  let reason: string;

  if (left < 0) {
    state = 'breached';
    reason = `${overdueDays} days past the ${deadlineDays}-day limit. The deduction on ${formatShort(outstanding)} leaves ${fy.label} and returns only in the year you pay, and interest of ${formatShort(exposure.interest_accrued)} has accrued at ${exposure.interest_rate_pct}% compounded monthly. Total cost so far ${formatShort(exposure.total_cost)}.${termNote}${clockNote}`;
  } else if (elapsed >= ESCALATE_AT_DAYS) {
    state = 'urgent';
    reason = `${left} days left. Pay now or ${formatShort(exposure.tax_deferred)} of deduction on ${formatShort(outstanding)} leaves ${fy.label}.${termNote}${clockNote}`;
  } else if (elapsed >= WARN_AT_DAYS) {
    state = 'due_soon';
    reason = `${left} days left before the ${deadlineDays}-day limit.${termNote}${clockNote}`;
  } else {
    state = 'safe';
    reason = `${left} days left. Comfortable.${termNote}${clockNote}`;
  }

  const atRisk = state === 'breached' || state === 'urgent' ? outstanding : 0;
  const partPaid = Number(po.amount_paid ?? 0) > 0;

  return {
    ...base,
    state,
    days_elapsed: elapsed,
    days_left: left,
    due_date: dueDate,
    amount_at_risk: atRisk,
    tax_deferred: atRisk > 0 ? exposure.tax_deferred : 0,
    interest_accrued: exposure.interest_accrued,
    total_cost: atRisk > 0 ? exposure.total_cost : exposure.interest_accrued,
    deduction_year: state === 'breached' ? 'year_of_payment' : 'accrual_year',
    reason: partPaid
      ? `${formatShort(Number(po.amount_paid))} of ${formatShort(Number(po.total_amount))} already paid. ${reason}`
      : reason,
  };
}

export interface ComplianceSummary {
  total_msme_pos: number;
  breached: number;
  urgent: number;
  due_soon: number;
  safe: number;
  awaiting_invoice: number;
  paid_on_time: number;
  paid_late: number;
  amount_paid_late: number;
  amount_at_risk: number;
  tax_at_risk: number;
  interest_accrued: number;
  total_cost_if_unpaid: number;
  unverified_msme: number;
  excluded_msme: number;
  current_fy: string;
  days_to_fy_end: number;
  worst: ComplianceRow | null;
  rows: ComplianceRow[];
}

export function summarise(
  pos: CompliancePo[],
  now: Date = new Date(),
  rates: Rates = DEFAULT_RATES
): ComplianceSummary {
  const rows = pos.map((p) => assessPo(p, now, rates));
  const msmeRows = rows.filter((r) => r.covered === true);

  const byUrgency: Record<ComplianceState, number> = {
    breached: 0, urgent: 1, due_soon: 2, safe: 3, paid: 4, not_applicable: 5,
  };

  const active = msmeRows
    .filter((r) => r.state !== 'paid' && r.state !== 'not_applicable')
    .sort((a, b) => byUrgency[a.state] - byUrgency[b.state] || (a.days_left ?? 0) - (b.days_left ?? 0));

  const paidRows = msmeRows.filter((r) => r.state === 'paid');
  const paidLate = paidRows.filter((r) => r.days_elapsed !== null && r.days_elapsed > r.deadline_days);
  const fy = financialYear(now);

  return {
    total_msme_pos: msmeRows.length,
    breached: msmeRows.filter((r) => r.state === 'breached').length,
    urgent: msmeRows.filter((r) => r.state === 'urgent').length,
    due_soon: msmeRows.filter((r) => r.state === 'due_soon').length,
    safe: msmeRows.filter((r) => r.state === 'safe').length,
    awaiting_invoice: msmeRows.filter((r) => r.state === 'not_applicable' && !r.clock_start).length,
    paid_on_time: paidRows.length - paidLate.length,
    paid_late: paidLate.length,
    amount_paid_late: paidLate.reduce((sum, r) => sum + Number(r.total_amount), 0),
    amount_at_risk: msmeRows.reduce((sum, r) => sum + r.amount_at_risk, 0),
    tax_at_risk: msmeRows.reduce((sum, r) => sum + r.tax_deferred, 0),
    interest_accrued: msmeRows.reduce((sum, r) => sum + r.interest_accrued, 0),
    total_cost_if_unpaid: msmeRows.reduce((sum, r) => sum + r.total_cost, 0),
    unverified_msme: rows.filter((r) => r.covered === null).length,
    excluded_msme: rows.filter((r) => r.covered === false).length,
    current_fy: fy.label,
    days_to_fy_end: daysBetween(now, fy.end),
    worst: active[0] || null,
    rows: rows.sort((a, b) => byUrgency[a.state] - byUrgency[b.state]),
  };
}

function formatShort(amount: number): string {
  if (amount >= 10000000) return '₹' + (Math.round((amount / 10000000) * 100) / 100).toFixed(2) + ' Cr';
  if (amount >= 100000) return '₹' + (Math.round((amount / 100000) * 100) / 100).toFixed(2) + ' L';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export { formatShort };
