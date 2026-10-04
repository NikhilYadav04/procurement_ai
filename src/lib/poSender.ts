import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { generatePoPdf } from '@/lib/poGenerator';
import { gmailService } from '@/lib/gmailService';
import { getGmailTokens } from '@/lib/quoteSync';
import { termsFor, coverageFor, formatShort } from '@/lib/msmeCompliance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface SendPoResult {
  success: boolean;
  error?: string;
  po_number?: string;
  sent_to?: string;
  message_id?: string | null;
  already_sent?: boolean;
}

function emailBody(po: any, termDays: number, covered: boolean | null): string {
  const lines = [
    `<p>Dear ${po.vendor_name || 'Supplier'},</p>`,
    `<p>Please find attached purchase order <b>${po.po_number}</b> for ${formatShort(Number(po.total_amount))}${po.title ? `, covering ${po.title}` : ''}.</p>`,
  ];

  if (po.delivery_days) {
    lines.push(`<p>Delivery is expected within ${po.delivery_days} days of this order.</p>`);
  }

  if (covered === true) {
    lines.push(
      `<p>Payment falls due within ${termDays} days of our acceptance of the goods. Please send your invoice once delivery is made so we can settle within that period.</p>`
    );
  } else {
    lines.push(`<p>Please send your invoice once delivery is made.</p>`);
  }

  lines.push(
    `<p>Regards,<br>${po.buyer_contact || po.buyer_company || 'Procurement'}<br>${po.buyer_company || ''}</p>`
  );
  return lines.join('');
}

export async function sendPurchaseOrder(
  userId: string,
  customerEmail: string,
  poNumber: string,
  options: { resend?: boolean } = {}
): Promise<SendPoResult> {
  const email = customerEmail.toLowerCase();

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('po_number', poNumber.toUpperCase())
    .eq('customer_email', email)
    .maybeSingle();

  if (!po) {
    return { success: false, error: `${poNumber} not found.` };
  }

  if (po.sent_at && !options.resend) {
    return {
      success: true,
      already_sent: true,
      po_number: po.po_number,
      sent_to: po.vendor_email,
      error: `${po.po_number} was already emailed to ${po.vendor_email}. Ask to resend if you want another copy.`,
    };
  }

  const tokens = await getGmailTokens(userId);
  if (!tokens) {
    return {
      success: false,
      error: 'Gmail is not connected. Connect it in Settings before sending a purchase order.',
    };
  }

  const vendorLookup = await supabase
    .from('vendors')
    .select('gstin, udyam_number, msme_category, udyam_activity, is_msme')
    .eq('email', po.vendor_email)
    .eq('customer_email', email)
    .maybeSingle();

  const vendor: any = vendorLookup.data || {};

  const { data: buyerProfile } = await supabase
    .from('userprofile')
    .select('company_gstin')
    .eq('email', email)
    .maybeSingle();

  const pdfPath = await generatePoPdf({
    po_number: po.po_number,
    rfp_number: po.rfp_number || '',
    rfp_title: po.title || '',
    buyer_company: po.buyer_company || '',
    buyer_contact: po.buyer_contact || '',
    buyer_email: po.buyer_email || email,
    vendor_name: po.vendor_name || po.vendor_email,
    vendor_email: po.vendor_email,
    total_amount: Number(po.total_amount),
    currency: po.currency || 'INR',
    delivery_days: po.delivery_days,
    payment_terms: po.payment_terms,
    warranty: po.warranty,
    line_items: Array.isArray(po.line_items) ? po.line_items : [],
    buyer_gstin: buyerProfile?.company_gstin ?? null,
    vendor_gstin: vendor.gstin ?? null,
    vendor_udyam: vendor.udyam_number ?? null,
    vendor_msme_category: po.vendor_msme_category ?? vendor.msme_category ?? null,
    vendor_udyam_activity: po.vendor_udyam_activity ?? vendor.udyam_activity ?? null,
  });

  const term = termsFor(po.payment_terms ?? null);
  const coverage = coverageFor({
    is_msme: po.vendor_is_msme ?? vendor.is_msme,
    msme_category: po.vendor_msme_category ?? vendor.msme_category,
    udyam_activity: po.vendor_udyam_activity ?? vendor.udyam_activity,
  });

  const sendResult = await gmailService.sendEmail(tokens, {
    to: po.vendor_email,
    subject: `Purchase order ${po.po_number}${po.title ? ` — ${po.title}` : ''}`,
    htmlBody: emailBody(po, term.days, coverage.covered),
    attachments: [
      {
        filename: `${po.po_number}.pdf`,
        content: fs.readFileSync(pdfPath).toString('base64'),
        encoding: 'base64',
      },
    ],
  });

  if (!sendResult.success) {
    return { success: false, error: 'Gmail refused the message.' };
  }

  const sentAt = new Date().toISOString();

  await supabase
    .from('purchase_orders')
    .update({ status: 'sent', sent_at: sentAt, updated_at: sentAt })
    .eq('id', po.id);

  await supabase.from('compliance_events').insert({
    po_id: po.id,
    po_number: po.po_number,
    customer_email: email,
    event: 'notified',
    occurred_at: sentAt,
    actor: email,
    note: `Purchase order emailed to ${po.vendor_email}.`,
  });

  return {
    success: true,
    po_number: po.po_number,
    sent_to: po.vendor_email,
    message_id: sendResult.messageId,
  };
}
