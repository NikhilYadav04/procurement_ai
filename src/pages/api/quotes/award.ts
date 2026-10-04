import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generatePoPdf } from '@/lib/poGenerator';
import { withUser } from '@/lib/auth';
import { termsFor, coverageFor, NO_AGREEMENT_DAYS } from '@/lib/msmeCompliance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { quoteId } = req.body as { quoteId?: string };
  const customerEmail = user.email;

  if (!quoteId) {
    return res.status(400).json({ success: false, error: 'quoteId is required' });
  }

  try {
    const { data: quote } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('customer_email', customerEmail.toLowerCase())
      .maybeSingle();

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    const { data: rfp } = await supabase
      .from('rfps')
      .select('id, rfp_number, title, company_name, contact_name, contact_email, status')
      .eq('id', quote.rfp_id)
      .maybeSingle();

    if (!rfp) {
      return res.status(404).json({ success: false, error: 'Parent RFP not found' });
    }

    const { data: alreadyAwarded } = await supabase
      .from('quotes')
      .select('id, vendor_name')
      .eq('rfp_id', rfp.id)
      .eq('status', 'awarded')
      .maybeSingle();

    if (alreadyAwarded && alreadyAwarded.id !== quoteId) {
      return res.status(409).json({
        success: false,
        error: `${rfp.rfp_number} was already awarded to ${alreadyAwarded.vendor_name}`,
      });
    }

    const poNumber = `PO-${rfp.rfp_number.replace(/^RFP-/, '')}`;

    const { data: allQuotes } = await supabase
      .from('quotes')
      .select('total_amount')
      .eq('rfp_id', rfp.id);

    const highest = Math.max(...(allQuotes || []).map((q) => Number(q.total_amount) || 0));
    const savings = highest > Number(quote.total_amount) ? highest - Number(quote.total_amount) : 0;

    const vendorWithMaster = await supabase
      .from('vendors')
      .select('is_msme, total_wins, gstin, udyam_number, msme_category, udyam_activity')
      .eq('email', quote.vendor_email)
      .eq('customer_email', customerEmail.toLowerCase())
      .maybeSingle();

    const vendorFallback = vendorWithMaster.error
      ? await supabase
          .from('vendors')
          .select('is_msme, total_wins')
          .eq('email', quote.vendor_email)
          .eq('customer_email', customerEmail.toLowerCase())
          .maybeSingle()
      : null;

    const vendor: any = vendorFallback ? vendorFallback.data : vendorWithMaster.data;

    const { data: buyerProfile } = await supabase
      .from('userprofile')
      .select('company_gstin')
      .eq('email', customerEmail.toLowerCase())
      .maybeSingle();

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .upsert(
        {
          po_number: poNumber,
          rfp_id: rfp.id,
          quote_id: quoteId,
          rfp_number: rfp.rfp_number,
          customer_email: customerEmail.toLowerCase(),
          buyer_company: rfp.company_name || 'Procurix',
          buyer_contact: rfp.contact_name || '',
          buyer_email: rfp.contact_email || customerEmail,
          vendor_email: quote.vendor_email,
          vendor_name: quote.vendor_name || quote.vendor_email,
          vendor_is_msme: vendor?.is_msme ?? null,
          vendor_msme_category: vendor?.msme_category ?? null,
          vendor_udyam_activity: vendor?.udyam_activity ?? null,
          title: rfp.title,
          total_amount: Number(quote.total_amount),
          currency: quote.currency || 'INR',
          delivery_days: quote.delivery_days,
          payment_terms: quote.payment_terms,
          warranty: quote.warranty,
          line_items: Array.isArray(quote.line_items) ? quote.line_items : [],
          savings_vs_highest: savings,
          status: 'issued',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'po_number' }
      )
      .select('id')
      .single();

    if (poError) {
      console.error('[AWARD] Could not create purchase order:', poError.message);
      return res.status(500).json({ success: false, error: `Could not create purchase order: ${poError.message}` });
    }

    let pdfPath: string | null = null;
    try {
      pdfPath = await generatePoPdf({
        po_number: poNumber,
        rfp_number: rfp.rfp_number,
        rfp_title: rfp.title,
        buyer_company: rfp.company_name || 'Procurix',
        buyer_contact: rfp.contact_name || '',
        buyer_email: rfp.contact_email || customerEmail,
        vendor_name: quote.vendor_name || quote.vendor_email,
        vendor_email: quote.vendor_email,
        total_amount: Number(quote.total_amount),
        currency: quote.currency || 'INR',
        delivery_days: quote.delivery_days,
        payment_terms: quote.payment_terms,
        warranty: quote.warranty,
        line_items: Array.isArray(quote.line_items) ? quote.line_items : [],
        buyer_gstin: buyerProfile?.company_gstin ?? null,
        vendor_gstin: vendor?.gstin ?? null,
        vendor_udyam: vendor?.udyam_number ?? null,
        vendor_msme_category: vendor?.msme_category ?? null,
        vendor_udyam_activity: vendor?.udyam_activity ?? null,
      });
    } catch (err: any) {
      console.error('[AWARD] PO pdf generation failed, record still created:', err.message);
    }

    await supabase.from('quotes').update({ status: 'awarded' }).eq('id', quoteId);
    await supabase.from('quotes').update({ status: 'rejected' }).eq('rfp_id', rfp.id).neq('id', quoteId);
    await supabase.from('rfps').update({ status: 'awarded', updated_at: new Date().toISOString() }).eq('id', rfp.id);

    await supabase
      .from('vendors')
      .update({ total_wins: (vendor?.total_wins ?? 0) + 1 })
      .eq('email', quote.vendor_email)
      .eq('customer_email', customerEmail.toLowerCase());

    const term = termsFor(quote.payment_terms ?? null);
    const coverage = coverageFor({
      is_msme: vendor?.is_msme,
      msme_category: vendor?.msme_category,
      udyam_activity: vendor?.udyam_activity,
    });

    await supabase.from('compliance_events').insert({
      po_id: po.id,
      po_number: poNumber,
      customer_email: customerEmail.toLowerCase(),
      event: 'invoiced',
      occurred_at: new Date().toISOString(),
      actor: customerEmail,
      amount: Number(quote.total_amount),
      note: `Purchase order issued to ${quote.vendor_name || quote.vendor_email} on ${term.basis === 'written' ? `${term.days}-day written terms` : 'no written credit term'}.`,
    });

    const termWarning =
      coverage.covered === true && term.basis !== 'written'
        ? `No credit period is written on this order, so the law allows only ${NO_AGREEMENT_DAYS} days from acceptance instead of up to 45. Add a payment term to the quote and reissue if you need longer.`
        : null;

    return res.status(200).json({
      success: true,
      po_id: po.id,
      po_number: poNumber,
      pdf_available: pdfPath !== null,
      vendor_name: quote.vendor_name,
      total_amount: quote.total_amount,
      savings_vs_highest: savings,
      rfp_number: rfp.rfp_number,
      covered_by_43bh: coverage.covered,
      payment_term_days: term.days,
      payment_term_basis: term.basis,
      term_warning: termWarning,
    });
  } catch (error: any) {
    console.error('[AWARD] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
