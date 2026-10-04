import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withUser } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { data: gmailIntegration } = await supabase
      .from('user_integrations')
      .select('connected_at')
      .eq('user_id', user.userId)
      .eq('integration_type', 'gmail')
      .eq('is_active', true)
      .maybeSingle();

    res.status(200).json({
      gmail: {
        connected: !!gmailIntegration,
        connectedAt: gmailIntegration?.connected_at || null,
      },
    });
  } catch (error: any) {
    console.error('Error checking integration status:', error);
    res.status(500).json({ message: error.message || 'Failed to check status' });
  }
});
