import type { NextApiRequest, NextApiResponse } from 'next';
import { gmailService } from '@/lib/gmailService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/dashboard/?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.status(400).json({ message: 'Missing authorization code or state' });
    }

    const userId = state as string;

    // Exchange code for tokens
    const tokens = await gmailService.getTokens(code as string);

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        integration_type: 'gmail',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        is_active: true,
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,integration_type',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return res.redirect(`/dashboard/?error=${encodeURIComponent('Failed to save integration')}`);
    }

    // Redirect to success page
    res.redirect('/dashboard/?integration=gmail&status=success');
  } catch (error: any) {
    console.error('Gmail OAuth callback error:', error);
    res.redirect(`/dashboard/?error=${encodeURIComponent(error.message || 'OAuth failed')}`);
  }
}
