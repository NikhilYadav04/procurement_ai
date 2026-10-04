import type { NextApiRequest, NextApiResponse } from 'next';
import { syncQuotes } from '@/lib/quoteSync';
import { withUser } from '@/lib/auth';

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { days, maxMessages } = req.body as {
    days?: number;
    maxMessages?: number;
  };

  try {
    const result = await syncQuotes(user.userId, user.email, { days, maxMessages });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('[QUOTES SYNC API] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
