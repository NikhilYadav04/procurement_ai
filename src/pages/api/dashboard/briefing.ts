import type { NextApiRequest, NextApiResponse } from 'next';
import { withUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const email = user.email;

  try {
    const [rfpsRes, posRes] = await Promise.all([
      supabaseAdmin.from('rfps').select('id, rfp_number').eq('customer_email', email),
      supabaseAdmin
        .from('purchase_orders')
        .select('po_number, savings_vs_highest')
        .eq('customer_email', email),
    ]);

    if (rfpsRes.error) {
      return res.status(500).json({ success: false, error: rfpsRes.error.message });
    }
    if (posRes.error) {
      return res.status(500).json({ success: false, error: posRes.error.message });
    }

    const awarded = (posRes.data || []).filter((p: any) => Number(p.savings_vs_highest) > 0);
    const savedTotal = awarded.reduce(
      (sum: number, p: any) => sum + Number(p.savings_vs_highest || 0),
      0
    );

    const rfps = rfpsRes.data || [];
    let quotesWaiting = 0;
    let quotesRfpNumber: string | null = null;

    if (rfps.length > 0) {
      const { data: waitingQuotes, error: quotesError } = await supabaseAdmin
        .from('quotes')
        .select('id, rfp_id')
        .in('rfp_id', rfps.map((r: any) => r.id))
        .eq('status', 'received');

      if (quotesError) {
        return res.status(500).json({ success: false, error: quotesError.message });
      }

      quotesWaiting = waitingQuotes?.length || 0;
      if (quotesWaiting > 0) {
        const firstRfpId = waitingQuotes![0].rfp_id;
        quotesRfpNumber = rfps.find((r: any) => r.id === firstRfpId)?.rfp_number || null;
      }
    }

    return res.status(200).json({
      success: true,
      quotesWaiting,
      quotesRfpNumber,
      savedTotal,
      savedCount: awarded.length,
    });
  } catch (error: any) {
    console.error('[DASHBOARD BRIEFING] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
