import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseQuoteFromPdf, parseQuoteFromText, isParseableAttachment } from '@/lib/quoteParser';
import { withUser } from '@/lib/auth';

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);

    const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploaded) {
      return res.status(400).json({ success: false, error: 'No file received' });
    }

    const customerEmail = user.email;
    const filename = uploaded.originalFilename || 'attachment';
    const mimeType = uploaded.mimetype || 'application/octet-stream';

    if (!isParseableAttachment(mimeType, filename)) {
      const text = fs.readFileSync(uploaded.filepath, 'utf8').slice(0, 8000);
      fs.unlink(uploaded.filepath, () => {});
      return res.status(200).json({ success: true, quote_saved: false, extracted_text: text });
    }

    const base64 = fs.readFileSync(uploaded.filepath).toString('base64');
    fs.unlink(uploaded.filepath, () => {});

    let openRfp: any = null;
    if (customerEmail) {
      const { data } = await supabase
        .from('rfps')
        .select('id, rfp_number, title, status')
        .eq('customer_email', customerEmail.toLowerCase())
        .in('status', ['draft', 'sent', 'quoting'])
        .order('created_at', { ascending: false })
        .limit(1);
      openRfp = data && data.length === 1 ? data[0] : null;
    }

    const context = openRfp
      ? `Uploaded file "${filename}". Possibly a quote for RFP ${openRfp.rfp_number}: ${openRfp.title}`
      : `Uploaded file "${filename}"`;

    const mime = mimeType === 'application/octet-stream' ? 'application/pdf' : mimeType;
    const parsed = await parseQuoteFromPdf(base64, mime, context);

    if (!parsed || !parsed.is_quote || parsed.total_amount === null) {
      return res.status(200).json({
        success: true,
        quote_saved: false,
        extracted_text: parsed?.notes || 'The document was read but contained no pricing.',
      });
    }

    if (!openRfp || !customerEmail) {
      return res.status(200).json({
        success: true,
        quote_saved: false,
        extracted_text: `A quote from ${parsed.vendor_name || 'an unnamed vendor'} for ${parsed.currency} ${parsed.total_amount}${parsed.delivery_days ? `, delivery ${parsed.delivery_days} days` : ''}. Not saved because there is no single open RFP to attach it to.`,
      });
    }

    const { error } = await supabase.from('quotes').insert({
      rfp_id: openRfp.id,
      rfp_number: openRfp.rfp_number,
      customer_email: customerEmail.toLowerCase(),
      vendor_email: `upload+${Date.now()}@procurix.local`,
      vendor_name: parsed.vendor_name || 'Uploaded quote',
      total_amount: parsed.total_amount,
      currency: parsed.currency || 'INR',
      delivery_days: parsed.delivery_days,
      payment_terms: parsed.payment_terms,
      warranty: parsed.warranty,
      line_items: parsed.line_items,
      notes: parsed.notes,
      source: 'upload',
      confidence: parsed.confidence,
      status: 'received',
    });

    if (error) {
      return res.status(200).json({ success: true, quote_saved: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      quote_saved: true,
      vendor_name: parsed.vendor_name || 'Uploaded quote',
      total_amount: parsed.total_amount,
      delivery_days: parsed.delivery_days,
      rfp_number: openRfp.rfp_number,
    });
  } catch (error: any) {
    console.error('[QUOTE UPLOAD] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
