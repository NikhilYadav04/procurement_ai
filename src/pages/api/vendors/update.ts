import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withUser } from '@/lib/auth';
import { checkUdyam } from '@/lib/gstVerify';
import { coverageFor, normaliseActivity, normaliseCategory } from '@/lib/msmeCompliance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORIES = ['micro', 'small', 'medium', 'not_registered'];
const ACTIVITIES = ['manufacturing', 'service', 'trading'];

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { vendorId, msme_category, udyam_activity, udyam_number } = req.body as {
    vendorId?: string;
    msme_category?: string | null;
    udyam_activity?: string | null;
    udyam_number?: string | null;
  };

  if (!vendorId) {
    return res.status(400).json({ success: false, error: 'vendorId is required' });
  }

  if (msme_category && !CATEGORIES.includes(msme_category)) {
    return res.status(400).json({ success: false, error: 'Unknown MSME category' });
  }

  if (udyam_activity && !ACTIVITIES.includes(udyam_activity)) {
    return res.status(400).json({ success: false, error: 'Unknown Udyam activity' });
  }

  let verifiedUdyam: string | null | undefined;
  if (udyam_number !== undefined) {
    if (!udyam_number || !udyam_number.trim()) {
      verifiedUdyam = null;
    } else {
      const check = checkUdyam(udyam_number);
      if (!check.valid) {
        return res.status(400).json({ success: false, error: check.reason });
      }
      verifiedUdyam = check.udyam || null;
    }
  }

  try {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, is_msme')
      .eq('id', vendorId)
      .eq('customer_email', user.email)
      .maybeSingle();

    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const category = msme_category ? normaliseCategory(msme_category) : undefined;
    const activity = udyam_activity ? normaliseActivity(udyam_activity) : undefined;

    const update: Record<string, any> = {
      msme_source: 'self_reported',
      msme_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (category !== undefined) {
      update.msme_category = category;
      update.is_msme = category === 'micro' || category === 'small';
    }
    if (activity !== undefined) update.udyam_activity = activity;
    if (verifiedUdyam !== undefined) update.udyam_number = verifiedUdyam;

    const attempt = await supabase.from('vendors').update(update).eq('id', vendorId);

    if (attempt.error) {
      const { msme_category: _c, udyam_activity: _a, msme_source: _s, ...legacy } = update;
      const retry = await supabase.from('vendors').update(legacy).eq('id', vendorId);
      if (retry.error) {
        return res.status(500).json({ success: false, error: retry.error.message });
      }
      return res.status(200).json({
        success: true,
        warning:
          'Only the Udyam number was saved. Run database/phase7-msme-master.sql to store the category and activity.',
      });
    }

    const coverage = coverageFor({
      is_msme: update.is_msme ?? vendor.is_msme,
      msme_category: category,
      udyam_activity: activity,
    });

    return res.status(200).json({
      success: true,
      covered: coverage.covered,
      coverage_reason: coverage.reason,
    });
  } catch (error: any) {
    console.error('[VENDORS UPDATE] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
