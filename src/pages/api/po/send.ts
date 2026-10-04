import type { NextApiRequest, NextApiResponse } from 'next';
import { withUser } from '@/lib/auth';
import { sendPurchaseOrder } from '@/lib/poSender';

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { poNumber, resend } = req.body as { poNumber?: string; resend?: boolean };

  if (!poNumber) {
    return res.status(400).json({ success: false, error: 'poNumber is required' });
  }

  try {
    const result = await sendPurchaseOrder(user.userId, user.email, poNumber, { resend });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('[PO SEND] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
