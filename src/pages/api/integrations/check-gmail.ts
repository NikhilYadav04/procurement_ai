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
    const { data: integrations, error } = await supabase
      .from('user_integrations')
      .select('integration_type, is_active, connected_at, token_expiry')
      .eq('user_id', user.userId);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const gmail = (integrations || []).find(
      (i) => i.integration_type === 'gmail' && i.is_active
    );

    return res.status(200).json({
      userId: user.userId,
      integrations: integrations || [],
      gmail: {
        connected: !!gmail,
        connectedAt: gmail?.connected_at || null,
        tokenExpiry: gmail?.token_expiry || null,
      },
    });
  } catch (error: any) {
    console.error('[CHECK GMAIL] Failed:', error);
    return res.status(500).json({ message: error.message || 'Failed to check Gmail' });
  }
});
