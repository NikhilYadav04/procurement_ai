import { createClient } from '@supabase/supabase-js';
import { sendMailForUser } from '@/lib/mailer';
import { buildRegister } from '@/pages/api/compliance/register';
import { formatShort, WARN_AT_DAYS, ESCALATE_AT_DAYS, financialYear } from '@/lib/msmeCompliance';
import { halfYearFor } from '@/lib/msme1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type NotificationLevel = 'day_30' | 'day_40' | 'breached' | 'fy_end' | 'msme1_due';

export const FY_END_WARNING_DAYS = 30;
export const MSME1_WARNING_DAYS = 14;

export interface WatchOptions {
  dryRun?: boolean;
  customerEmail?: string;
  now?: Date;
}

export interface WatchOutcome {
  customer: string;
  level: NotificationLevel;
  po_number: string | null;
  subject: string;
  sent: boolean;
  reason?: string;
}

export interface WatchResult {
  checked_customers: number;
  considered: number;
  sent: number;
  skipped_already_sent: number;
  skipped_no_gmail: number;
  failed: number;
  dry_run: boolean;
  outcomes: WatchOutcome[];
}

export function levelForRow(row: any): NotificationLevel | null {
  if (row.covered !== true) return null;
  if (row.state === 'paid' || row.state === 'not_applicable') return null;
  if (Number(row.outstanding) <= 0) return null;
  if (row.state === 'breached') return 'breached';
  if (row.days_elapsed === null) return null;
  if (row.state === 'urgent' || row.days_elapsed >= ESCALATE_AT_DAYS) return 'day_40';
  if (row.state === 'due_soon' || row.days_elapsed >= WARN_AT_DAYS) return 'day_30';
  return null;
}

function orderMail(row: any, level: NotificationLevel, fyLabel: string) {
  const amount = formatShort(row.outstanding);
  const supplier = row.vendor_name || row.vendor_email;

  if (level === 'breached') {
    return {
      subject: `${row.po_number} is past its payment deadline`,
      htmlBody: [
        `<p>${row.po_number} to <b>${supplier}</b> is <b>${Math.abs(row.days_left ?? 0)} days past</b> its ${row.deadline_days}-day limit.</p>`,
        `<p>${amount} is still outstanding. The deduction on it leaves ${fyLabel} and returns only in the year you pay, and interest of ${formatShort(row.interest_accrued)} has accrued at three times the RBI bank rate, compounded monthly.</p>`,
        `<p>Paying now stops the interest growing. It does not restore the deduction to ${fyLabel}.</p>`,
      ].join(''),
    };
  }

  if (level === 'day_40') {
    return {
      subject: `${row.po_number} is due in ${row.days_left} days`,
      htmlBody: [
        `<p>${row.po_number} to <b>${supplier}</b> has <b>${row.days_left} days left</b> of its ${row.deadline_days}-day limit.</p>`,
        `<p>${amount} is outstanding. Miss the date and ${formatShort(row.tax_deferred)} of deduction leaves ${fyLabel}.</p>`,
        row.due_date ? `<p>Pay on or before <b>${row.due_date}</b>.</p>` : '',
      ].join(''),
    };
  }

  return {
    subject: `${row.po_number} reaches its payment deadline in ${row.days_left} days`,
    htmlBody: [
      `<p>${row.po_number} to <b>${supplier}</b> is at day ${row.days_elapsed} of ${row.deadline_days}.</p>`,
      `<p>${amount} is outstanding${row.due_date ? `, due on <b>${row.due_date}</b>` : ''}.</p>`,
    ].join(''),
  };
}

export function closedHalfBefore(now: Date) {
  const current = halfYearFor(now);
  const dayBefore = new Date(current.start);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return halfYearFor(dayBefore);
}

function calendarMail(level: NotificationLevel, register: any, now: Date) {
  if (level === 'fy_end') {
    const fy = financialYear(now);
    return {
      subject: `${register.totals.covered ? formatShort(register.totals.outstanding) + ' to pay before' : 'Before'} 31 March`,
      htmlBody: [
        `<p>${fy.label} ends on <b>${fy.end}</b>.</p>`,
        `<p>${formatShort(register.totals.outstanding)} is outstanding to micro and small suppliers. Anything unpaid past its deadline at year end moves its deduction to the year you eventually pay, which is ${formatShort(register.totals.tax_at_risk)} of deduction on current figures.</p>`,
      ].join(''),
    };
  }

  const half = closedHalfBefore(now);
  return {
    subject: `Form MSME-1 is due by ${half.filing_due}`,
    htmlBody: [
      `<p>The ${half.label} half-year has closed and Form MSME-1 is due by <b>${half.filing_due}</b>.</p>`,
      `<p>Open the Compliance page to export the working papers. ${register.applicability}</p>`,
    ].join(''),
  };
}

export async function alreadySent(
  customerEmail: string,
  poId: string | null,
  level: NotificationLevel
): Promise<boolean> {
  let query = supabase
    .from('compliance_notifications')
    .select('id')
    .eq('customer_email', customerEmail)
    .eq('level', level);

  query = poId ? query.eq('po_id', poId) : query.is('po_id', null);

  const { data } = await query.limit(1);
  return !!(data && data.length);
}

export async function recordSent(
  customerEmail: string,
  poId: string | null,
  poNumber: string | null,
  level: NotificationLevel
) {
  await supabase.from('compliance_notifications').insert({
    po_id: poId,
    po_number: poNumber,
    customer_email: customerEmail,
    level,
    sent_at: new Date().toISOString(),
  });
}

export async function customersWithOrders(): Promise<string[]> {
  const { data } = await supabase.from('purchase_orders').select('customer_email');
  const emails = (data || [])
    .map((row: any) => String(row.customer_email || '').toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(emails));
}

function calendarLevelsDue(now: Date): NotificationLevel[] {
  const levels: NotificationLevel[] = [];
  const fy = financialYear(now);

  const daysToFyEnd = Math.floor(
    (new Date(fy.end).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
  );
  if (daysToFyEnd >= 0 && daysToFyEnd <= FY_END_WARNING_DAYS) levels.push('fy_end');

  const closed = closedHalfBefore(now);
  const daysToFiling = Math.floor(
    (new Date(closed.filing_due).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
  );
  if (daysToFiling >= 0 && daysToFiling <= MSME1_WARNING_DAYS) {
    levels.push('msme1_due');
  }

  return levels;
}

export async function runComplianceWatch(options: WatchOptions = {}): Promise<WatchResult> {
  const now = options.now || new Date();
  const dryRun = !!options.dryRun;

  const customers = options.customerEmail
    ? [options.customerEmail.toLowerCase()]
    : await customersWithOrders();

  const result: WatchResult = {
    checked_customers: customers.length,
    considered: 0,
    sent: 0,
    skipped_already_sent: 0,
    skipped_no_gmail: 0,
    failed: 0,
    dry_run: dryRun,
    outcomes: [],
  };

  for (const customer of customers) {
    let register: any;
    try {
      register = await buildRegister(customer, now, now);
    } catch (error: any) {
      result.failed++;
      result.outcomes.push({
        customer,
        level: 'breached',
        po_number: null,
        subject: 'register failed',
        sent: false,
        reason: error.message,
      });
      continue;
    }

    const jobs: Array<{ level: NotificationLevel; row: any | null }> = [];

    for (const row of register.rows) {
      const level = levelForRow(row);
      if (level) jobs.push({ level, row });
    }

    for (const level of calendarLevelsDue(now)) {
      jobs.push({ level, row: null });
    }

    for (const job of jobs) {
      result.considered++;

      const poId = job.row?.id ?? null;
      const poNumber = job.row?.po_number ?? null;

      if (await alreadySent(customer, poId, job.level)) {
        result.skipped_already_sent++;
        result.outcomes.push({
          customer,
          level: job.level,
          po_number: poNumber,
          subject: '(already sent)',
          sent: false,
          reason: 'already sent',
        });
        continue;
      }

      const mail = job.row
        ? orderMail(job.row, job.level, register.financial_year)
        : calendarMail(job.level, register, now);

      if (dryRun) {
        result.outcomes.push({
          customer,
          level: job.level,
          po_number: poNumber,
          subject: mail.subject,
          sent: false,
          reason: 'dry run',
        });
        continue;
      }

      const sendResult = await sendMailForUser(customer, mail);

      if (sendResult.success) {
        await recordSent(customer, poId, poNumber, job.level);
        result.sent++;
        result.outcomes.push({
          customer,
          level: job.level,
          po_number: poNumber,
          subject: mail.subject,
          sent: true,
        });
      } else if (sendResult.skipped) {
        result.skipped_no_gmail++;
        result.outcomes.push({
          customer,
          level: job.level,
          po_number: poNumber,
          subject: mail.subject,
          sent: false,
          reason: sendResult.error,
        });
      } else {
        result.failed++;
        result.outcomes.push({
          customer,
          level: job.level,
          po_number: poNumber,
          subject: mail.subject,
          sent: false,
          reason: sendResult.error,
        });
      }
    }
  }

  return result;
}
