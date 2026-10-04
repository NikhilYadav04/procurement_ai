import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withUser } from '@/lib/auth';
import { summarise, financialYear, DEFAULT_RATES, type Rates } from '@/lib/msmeCompliance';
import { halfYearsOfFy, msme1Return, clause22, msme1Applicability, type Msme1Input } from '@/lib/msme1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PO_BASE =
  'id, po_number, vendor_name, vendor_email, vendor_is_msme, total_amount, payment_terms, invoice_received_at, paid_at, status';
const PO_CLOCK = PO_BASE + ', goods_accepted_at, delivered_at, amount_paid, vendor_msme_category, vendor_udyam_activity';
const PO_FULL = PO_CLOCK + ', objection_raised_at, objection_resolved_at';

async function readPurchaseOrders(customerEmail: string) {
  for (const columns of [PO_FULL, PO_CLOCK, PO_BASE]) {
    const attempt = await supabase
      .from('purchase_orders')
      .select(columns)
      .eq('customer_email', customerEmail);
    if (!attempt.error) return attempt.data as any[];
  }
  return [];
}

async function readVendors(customerEmail: string) {
  const withMaster = await supabase
    .from('vendors')
    .select('email, is_msme, msme_category, udyam_activity, udyam_number, gstin')
    .eq('customer_email', customerEmail);

  if (!withMaster.error) return withMaster.data as any[];

  const fallback = await supabase
    .from('vendors')
    .select('email, is_msme')
    .eq('customer_email', customerEmail);

  return (fallback.data as any[]) || [];
}

async function readProfile(customerEmail: string): Promise<{ rates: Rates; gstin: string | null }> {
  const { data, error } = await supabase
    .from('userprofile')
    .select('tax_rate_pct, bank_rate_pct, company_gstin')
    .eq('email', customerEmail)
    .maybeSingle();

  if (error || !data) return { rates: DEFAULT_RATES, gstin: null };

  return {
    rates: {
      tax_rate_pct: Number(data.tax_rate_pct) || DEFAULT_RATES.tax_rate_pct,
      bank_rate_pct: Number(data.bank_rate_pct) || DEFAULT_RATES.bank_rate_pct,
    },
    gstin: data.company_gstin ?? null,
  };
}

export async function buildRegister(customerEmail: string, fyDate: Date, now: Date = new Date()) {
  const [pos, vendors, profile] = await Promise.all([
    readPurchaseOrders(customerEmail),
    readVendors(customerEmail),
    readProfile(customerEmail),
  ]);

  const vendorByEmail = new Map(vendors.map((v) => [String(v.email).toLowerCase(), v]));

  const resolved = pos.map((p) => {
    const vendor: any = vendorByEmail.get(String(p.vendor_email).toLowerCase());
    return {
      ...p,
      vendor_is_msme: p.vendor_is_msme ?? vendor?.is_msme ?? null,
      vendor_msme_category: p.vendor_msme_category ?? vendor?.msme_category ?? null,
      vendor_udyam_activity: p.vendor_udyam_activity ?? vendor?.udyam_activity ?? null,
    };
  });

  const summary = summarise(resolved as any, now, profile.rates);
  const fy = financialYear(fyDate);

  const enriched: Msme1Input[] = summary.rows.map((row) => {
    const vendor: any = vendorByEmail.get(String(row.vendor_email).toLowerCase());
    return {
      ...row,
      udyam_number: vendor?.udyam_number ?? null,
      vendor_gstin: vendor?.gstin ?? null,
    };
  });

  const inYear = enriched.filter((row) => row.expense_fy === fy.label);
  const halves = halfYearsOfFy(fyDate).map((half) => msme1Return(enriched, half, now));

  return {
    financial_year: fy.label,
    fy_start: fy.start,
    fy_end: fy.end,
    rates: profile.rates,
    applicability: msme1Applicability(profile.gstin),
    rows: inYear,
    totals: {
      orders: inYear.length,
      covered: inYear.filter((r) => r.covered === true).length,
      excluded: inYear.filter((r) => r.covered === false).length,
      unconfirmed: inYear.filter((r) => r.covered === null).length,
      outstanding: inYear.reduce(
        (t, r) => t + (r.covered === true && r.clock_start ? r.outstanding_now : 0),
        0
      ),
      not_started: inYear.filter((r) => r.covered === true && !r.clock_start && r.outstanding_now > 0).length,
      not_started_amount: inYear.reduce(
        (t, r) => t + (r.covered === true && !r.clock_start ? r.outstanding_now : 0),
        0
      ),
      tax_at_risk: inYear.reduce((t, r) => t + r.tax_deferred, 0),
      interest: inYear.reduce((t, r) => t + r.interest_accrued, 0),
    },
    msme1: halves,
    clause22: clause22(enriched, fyDate, now),
    available_years: Array.from(
      new Set(enriched.map((r) => r.expense_fy).filter(Boolean))
    ).sort().reverse(),
  };
}

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const fyParam = String(req.query.fy || '');
    const fyDate = fyParam ? new Date(fyParam + '-06-01') : new Date();

    if (Number.isNaN(fyDate.getTime())) {
      return res.status(400).json({ success: false, error: 'fy must be a year, for example 2026' });
    }

    const register = await buildRegister(user.email, fyDate);
    return res.status(200).json({ success: true, ...register });
  } catch (error: any) {
    console.error('[COMPLIANCE REGISTER] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
