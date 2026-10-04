import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getRfpDir } from '@/lib/tmpDir';
import { generatePoPdf } from '@/lib/poGenerator';
import { withUser } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const poNumber = String(req.query.poNumber || '').toUpperCase();
  const customerEmail = user.email;

  if (!poNumber) {
    return res.status(400).json({ error: 'poNumber is required' });
  }

  try {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('po_number', poNumber)
      .eq('customer_email', customerEmail)
      .maybeSingle();

    if (!po) {
      return res.status(404).json({ error: `${poNumber} not found` });
    }

    let filePath = path.join(getRfpDir(), `${poNumber}.pdf`);

    if (!fs.existsSync(filePath)) {
      filePath = await generatePoPdf({
        po_number: po.po_number,
        rfp_number: po.rfp_number || '',
        rfp_title: po.title || '',
        buyer_company: po.buyer_company || 'Procurix',
        buyer_contact: po.buyer_contact || '',
        buyer_email: po.buyer_email || customerEmail,
        vendor_name: po.vendor_name || po.vendor_email,
        vendor_email: po.vendor_email,
        total_amount: Number(po.total_amount),
        currency: po.currency || 'INR',
        delivery_days: po.delivery_days,
        payment_terms: po.payment_terms,
        warranty: po.warranty,
        line_items: Array.isArray(po.line_items) ? po.line_items : [],
      });
    }

    const buffer = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${poNumber}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[PO DOWNLOAD] Failed:', error);
    return res.status(500).json({ error: error.message });
  }
});
