import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withUser } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const rfpNumber = String(req.query.rfpNumber || '').toUpperCase();
  const customerEmail = user.email;

  if (!rfpNumber) {
    return res.status(400).json({ success: false, error: 'rfpNumber is required' });
  }

  try {
    const { data: rfp } = await supabase
      .from('rfps')
      .select('id, rfp_number, title, status')
      .eq('rfp_number', rfpNumber)
      .eq('customer_email', customerEmail)
      .maybeSingle();

    if (!rfp) {
      return res.status(404).json({ success: false, error: `${rfpNumber} not found` });
    }

    const { data: allQuotes, error } = await supabase
      .from('quotes')
      .select('id, vendor_name, vendor_email, total_amount, delivery_days, payment_terms, warranty, confidence, status, received_at, revision_of')
      .eq('rfp_id', rfp.id)
      .order('total_amount', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const supersededIds = new Set(
      (allQuotes || []).map((q) => q.revision_of).filter((id): id is string => !!id)
    );

    const awarded = (allQuotes || []).find((q) => q.status === 'awarded');

    const quotes = (allQuotes || []).filter((q) => {
      if (supersededIds.has(q.id)) return false;
      if (awarded) return true;
      return q.status !== 'rejected';
    });

    const superseded = (allQuotes || [])
      .filter((q) => supersededIds.has(q.id))
      .map((q) => ({
        id: q.id,
        vendor_name: q.vendor_name,
        total_amount: q.total_amount,
        replaced_by: (allQuotes || []).find((r) => r.revision_of === q.id)?.total_amount ?? null,
      }));

    const emails = Array.from(new Set((quotes || []).map((q) => q.vendor_email)));
    const { data: vendors } = await supabase
      .from('vendors')
      .select('email, total_wins, total_auctions_participated')
      .in('email', emails.length ? emails : ['none']);

    const byEmail = new Map((vendors || []).map((v) => [v.email.toLowerCase(), v]));

    const enriched = (quotes || []).map((q) => {
      const vendor = byEmail.get(q.vendor_email.toLowerCase());
      return {
        ...q,
        vendor_wins: vendor?.total_wins ?? null,
        vendor_auctions: vendor?.total_auctions_participated ?? null,
      };
    });

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('po_number, vendor_name, total_amount, savings_vs_highest, delivery_days, issued_at, status')
      .eq('rfp_id', rfp.id)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      rfp_number: rfp.rfp_number,
      rfp_title: rfp.title,
      rfp_status: rfp.status,
      quotes: enriched,
      superseded,
      purchase_order: po || null,
    });
  } catch (error: any) {
    console.error('[QUOTES LIST] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
