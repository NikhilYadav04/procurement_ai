import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { gmailService } from '@/lib/gmailService';
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
    const { action } = req.body;

    if (action === 'connect') {
      const authUrl = gmailService.getAuthUrl(user.userId);
      return res.status(200).json({ authUrl });
    }

    if (action === 'disconnect') {
      await supabase
        .from('user_integrations')
        .update({ is_active: false })
        .eq('user_id', user.userId)
        .eq('integration_type', 'gmail');

      return res.status(200).json({ success: true, message: 'Gmail disconnected' });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error: any) {
    console.error('Gmail integration error:', error);
    res.status(500).json({ message: error.message || 'Integration failed' });
  }
});
