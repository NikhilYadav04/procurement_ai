import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { emailTool } from '../../../../agent/tools/emailtool';
import { withUser } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { negotiationId, subject, body, action } = req.body as {
    negotiationId?: string;
    subject?: string;
    body?: string;
    action?: 'send' | 'cancel';
  };

  const customerEmail = user.email;
  const userId = user.userId;

  if (!negotiationId) {
    return res.status(400).json({ success: false, error: 'negotiationId is required' });
  }

  try {
    const { data: negotiation } = await supabase
      .from('negotiations')
      .select('*')
      .eq('id', negotiationId)
      .eq('customer_email', customerEmail.toLowerCase())
      .maybeSingle();

    if (!negotiation) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }

    if (action === 'cancel') {
      await supabase.from('negotiations').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', negotiationId);
      return res.status(200).json({ success: true, cancelled: true });
    }

    if (negotiation.status === 'sent') {
      return res.status(409).json({ success: false, error: 'This counter-offer has already been sent.' });
    }

    const finalSubject = subject?.trim() || negotiation.subject;
    const finalBody = body?.trim() || negotiation.body;

    const htmlBody = finalBody
      .split('\n')
      .map((line: string) => (line.trim() ? `<p style="margin:0 0 12px;">${line}</p>` : ''))
      .join('');

    const emailResult: any = await emailTool.invoke(
      {
        to: negotiation.vendor_email,
        subject: finalSubject,
        message: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;">${htmlBody}</div>`,
        is_html: true,
      },
      { configurable: { userId } }
    );

    const parsed = typeof emailResult === 'string' ? JSON.parse(emailResult) : emailResult;

    if (!parsed?.success) {
      return res.status(200).json({
        success: false,
        error: parsed?.error || 'Could not send the email. Check that Gmail is connected in Settings.',
      });
    }

    await supabase
      .from('negotiations')
      .update({
        status: 'sent',
        subject: finalSubject,
        body: finalBody,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', negotiationId);

    return res.status(200).json({
      success: true,
      sent_to: negotiation.vendor_email,
      vendor_name: negotiation.vendor_name,
      asked_for: negotiation.target_amount,
    });
  } catch (error: any) {
    console.error('[NEGOTIATE SEND] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
