import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { summarise, DEFAULT_RATES, type Rates } from '@/lib/msmeCompliance';
import { withUser } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASE_COLUMNS =
  'id, po_number, vendor_name, vendor_email, vendor_is_msme, total_amount, payment_terms, invoice_received_at, paid_at, status';
const CLOCK_COLUMNS = `${BASE_COLUMNS}, goods_accepted_at, delivered_at, amount_paid, vendor_msme_category, vendor_udyam_activity`;
const FULL_COLUMNS = `${CLOCK_COLUMNS}, objection_raised_at, objection_resolved_at`;

async function readVendors(customerEmail: string, emails: string[]) {
  const list = emails.length ? emails : ['none'];

  const withMaster = await supabase
    .from('vendors')
    .select('email, is_msme, msme_category, udyam_activity')
    .eq('customer_email', customerEmail)
    .in('email', list);

  if (!withMaster.error) return withMaster.data;

  const fallback = await supabase
    .from('vendors')
    .select('email, is_msme')
    .eq('customer_email', customerEmail)
    .in('email', list);

  return fallback.data;
}

async function readPurchaseOrders(
  customerEmail: string
): Promise<{ data: any[]; error: any }> {
  let lastError: any = null;

  for (const columns of [FULL_COLUMNS, CLOCK_COLUMNS, BASE_COLUMNS]) {
    const attempt = await supabase
      .from('purchase_orders')
      .select(columns)
      .eq('customer_email', customerEmail);

    if (!attempt.error) return { data: (attempt.data as any[]) || [], error: null };
    lastError = attempt.error;
  }

  return { data: [], error: lastError };
}

async function readRates(customerEmail: string): Promise<Rates> {
  const { data, error } = await supabase
    .from('userprofile')
    .select('tax_rate_pct, bank_rate_pct')
    .eq('email', customerEmail)
    .maybeSingle();

  if (error || !data) return DEFAULT_RATES;

  return {
    tax_rate_pct: Number(data.tax_rate_pct) || DEFAULT_RATES.tax_rate_pct,
    bank_rate_pct: Number(data.bank_rate_pct) || DEFAULT_RATES.bank_rate_pct,
  };
}

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const customerEmail = user.email;

  try {
    const { data: pos, error } = await readPurchaseOrders(customerEmail);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const emails = Array.from(new Set((pos || []).map((p) => p.vendor_email.toLowerCase())));
    const vendors = await readVendors(customerEmail, emails);
    const vendorByEmail = new Map((vendors || []).map((v: any) => [v.email.toLowerCase(), v]));

    const resolved = (pos || []).map((p) => {
      const vendor: any = vendorByEmail.get(p.vendor_email.toLowerCase());
      return {
        ...p,
        vendor_is_msme: p.vendor_is_msme ?? vendor?.is_msme ?? null,
        vendor_msme_category: (p as any).vendor_msme_category ?? vendor?.msme_category ?? null,
        vendor_udyam_activity: (p as any).vendor_udyam_activity ?? vendor?.udyam_activity ?? null,
      };
    });

    const rates = await readRates(customerEmail);
    const summary = summarise(resolved as any, new Date(), rates);

    return res.status(200).json({
      success: true,
      amount_at_risk: summary.amount_at_risk,
      tax_at_risk: summary.tax_at_risk,
      interest_accrued: summary.interest_accrued,
      total_cost_if_unpaid: summary.total_cost_if_unpaid,
      unverified_msme: summary.unverified_msme,
      excluded_msme: summary.excluded_msme,
      current_fy: summary.current_fy,
      days_to_fy_end: summary.days_to_fy_end,
      tax_rate_pct: rates.tax_rate_pct,
      breached: summary.breached,
      urgent: summary.urgent,
      due_soon: summary.due_soon,
      safe: summary.safe,
      awaiting_invoice: summary.awaiting_invoice,
      paid_on_time: summary.paid_on_time,
      paid_late: summary.paid_late,
      amount_paid_late: summary.amount_paid_late,
      total_msme_pos: summary.total_msme_pos,
      total_pos: (pos || []).length,
      worst: summary.worst,
      rows: summary.rows,
    });
  } catch (error: any) {
    console.error('[COMPLIANCE SUMMARY] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
