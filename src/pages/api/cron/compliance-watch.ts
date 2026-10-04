import type { NextApiRequest, NextApiResponse } from 'next';
import { runComplianceWatch } from '@/lib/complianceWatch';

function authorised(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.authorization || '';
  if (header === `Bearer ${secret}`) return true;

  return String(req.query.secret || '') === secret;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CRON_SECRET) {
    console.error('[COMPLIANCE WATCH] CRON_SECRET is not set, refusing to run');
    return res.status(503).json({
      success: false,
      error: 'CRON_SECRET is not configured on the server, so this job cannot run.',
    });
  }

  if (!authorised(req)) {
    return res.status(401).json({ success: false, error: 'Not authorised' });
  }

  const dryRun = String(req.query.dryRun || '') === 'true';
  const customerEmail = req.query.customerEmail ? String(req.query.customerEmail) : undefined;

  try {
    const result = await runComplianceWatch({ dryRun, customerEmail });

    console.log(
      `[COMPLIANCE WATCH] ${result.checked_customers} customer(s), ${result.considered} considered, ` +
        `${result.sent} sent, ${result.skipped_already_sent} already sent, ${result.failed} failed`
    );

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[COMPLIANCE WATCH] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
