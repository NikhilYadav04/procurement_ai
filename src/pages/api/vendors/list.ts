import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withUser } from '@/lib/auth';
import { coverageFor } from '@/lib/msmeCompliance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASE_COLUMNS =
  'id, name, email, phone, address, website, gstin, legal_name, state_code, is_msme, udyam_number, msme_verified_at, total_wins, total_auctions_participated, created_at';
const MASTER_COLUMNS = `${BASE_COLUMNS}, msme_category, udyam_activity, msme_source, msme_declared_at`;

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const withMaster = await supabase
      .from('vendors')
      .select(MASTER_COLUMNS)
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false });

    const fallback = withMaster.error
      ? await supabase
          .from('vendors')
          .select(BASE_COLUMNS)
          .eq('customer_email', user.email)
          .order('created_at', { ascending: false })
      : null;

    const rows: any[] | null = fallback ? fallback.data : withMaster.data;
    const error = fallback ? fallback.error : withMaster.error;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const vendors = (rows || []).map((v) => {
      const coverage = coverageFor({
        is_msme: v.is_msme,
        msme_category: v.msme_category,
        udyam_activity: v.udyam_activity,
      });

      return {
        ...v,
        covered: coverage.covered,
        coverage_reason: coverage.reason,
        msme_category: coverage.category,
        udyam_activity: coverage.activity,
      };
    });

    return res.status(200).json({
      success: true,
      vendors,
      total: vendors.length,
      covered: vendors.filter((v) => v.covered === true).length,
      excluded: vendors.filter((v) => v.covered === false).length,
      unconfirmed: vendors.filter((v) => v.covered === null).length,
      master_columns_present: !fallback,
    });
  } catch (error: any) {
    console.error('[VENDORS LIST] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
