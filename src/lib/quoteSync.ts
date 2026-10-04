import { createClient } from '@supabase/supabase-js';
import { gmailService } from '@/lib/gmailService';
import {
  parseQuoteFromPdf,
  parseQuoteFromText,
  extractRfpNumber,
  isParseableAttachment,
} from '@/lib/quoteParser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_PARSES = 8;

export interface SyncResult {
  success: boolean;
  error?: string;
  scanned: number;
  quotes_saved: number;
  skipped: number;
  details: Array<{
    from: string;
    subject: string;
    outcome: string;
    rfp_number?: string;
    amount?: number;
  }>;
}

export async function getGmailTokens(userId: string) {
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('integration_type', 'gmail')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(`Database error: ${error.message}`);
  if (!integration) return null;

  let tokens: any = {
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
  };

  if (tokens.expiry_date && tokens.expiry_date < Date.now() && tokens.refresh_token) {
    const refreshed = await gmailService.refreshAccessToken(tokens.refresh_token);
    tokens = refreshed;
    await supabase
      .from('user_integrations')
      .update({
        access_token: refreshed.access_token,
        token_expiry: refreshed.expiry_date ? new Date(refreshed.expiry_date).toISOString() : null,
      })
      .eq('id', integration.id);
  }

  return tokens;
}

export async function syncQuotes(
  userId: string,
  customerEmail: string,
  options: { days?: number; maxMessages?: number } = {}
): Promise<SyncResult> {
  const days = options.days ?? 30;
  const maxMessages = options.maxMessages ?? 25;

  const result: SyncResult = {
    success: false,
    scanned: 0,
    quotes_saved: 0,
    skipped: 0,
    details: [],
  };

  let tokens;
  try {
    tokens = await getGmailTokens(userId);
  } catch (err: any) {
    result.error = err.message;
    return result;
  }

  if (!tokens) {
    result.error = 'Gmail is not connected. Open Settings and connect Gmail.';
    return result;
  }

  const { data: rfps } = await supabase
    .from('rfps')
    .select('id, rfp_number, title, status, created_at')
    .eq('customer_email', customerEmail.toLowerCase())
    .order('created_at', { ascending: false });

  if (!rfps || rfps.length === 0) {
    result.error = 'No RFPs found for this account. Create and send an RFP first.';
    return result;
  }

  const byNumber = new Map(rfps.map((r) => [r.rfp_number, r]));
  const openRfps = rfps.filter((r) => r.status !== 'closed' && r.status !== 'awarded');
  const fallbackRfp = openRfps.length === 1 ? openRfps[0] : null;

  const numberTerms = rfps.slice(0, 20).map((r) => `"${r.rfp_number}"`).join(' OR ');
  const query = `newer_than:${days}d -category:promotions -category:social (${numberTerms} OR quotation OR quote OR "our offer" OR proforma)`;

  let messageIds: string[] = [];
  try {
    messageIds = await gmailService.listMessages(tokens, query, maxMessages);
  } catch (err: any) {
    result.error = `Could not read Gmail: ${err.message}. If this mentions scope or insufficient permission, disconnect and reconnect Gmail in Settings.`;
    return result;
  }

  result.scanned = messageIds.length;

  const messages = (
    await Promise.all(
      messageIds.map(async (id) => {
        try {
          return await gmailService.getMessage(tokens, id);
        } catch {
          return null;
        }
      })
    )
  ).filter((m): m is NonNullable<typeof m> => m !== null);

  result.skipped += messageIds.length - messages.length;

  const candidates = [];
  for (const message of messages) {
    const rfpNumber = extractRfpNumber(message.subject, message.bodyText);
    const looksLikeQuote =
      /quot|proforma|offer|price|pricing|rate|tender|bid/i.test(message.subject + ' ' + message.bodyText.slice(0, 500));

    const rfp = rfpNumber ? byNumber.get(rfpNumber) : looksLikeQuote ? fallbackRfp : null;

    if (!rfp) {
      result.skipped++;
      continue;
    }
    candidates.push({ message, rfp });
  }

  for (const { message, rfp } of candidates.slice(0, MAX_PARSES)) {
    const messageId = message.id;

    const { data: existing } = await supabase
      .from('quotes')
      .select('id')
      .eq('rfp_id', rfp.id)
      .eq('raw_email_id', messageId)
      .maybeSingle();

    if (existing) {
      result.skipped++;
      continue;
    }

    const context = `RFP ${rfp.rfp_number}: ${rfp.title}. Sender: ${message.fromEmail}. Subject: ${message.subject}`;
    const attachment = message.attachments.find(
      (a) => isParseableAttachment(a.mimeType, a.filename) && !/^RFP[-_\s]?\d+/i.test(a.filename)
    );

    let parsed = null;

    if (attachment) {
      try {
        const base64 = await gmailService.getAttachment(tokens, messageId, attachment.attachmentId);
        if (base64) {
          const mime = attachment.mimeType === 'application/octet-stream'
            ? 'application/pdf'
            : attachment.mimeType;
          parsed = await parseQuoteFromPdf(base64, mime, context);
        }
      } catch (err: any) {
        console.error('[QUOTE SYNC] Attachment read failed:', err.message);
      }
    }

    if (!parsed || !parsed.is_quote) {
      parsed = await parseQuoteFromText(message.bodyText, context);
    }

    if (!parsed || !parsed.is_quote || parsed.total_amount === null) {
      result.skipped++;
      result.details.push({
        from: message.fromEmail,
        subject: message.subject,
        outcome: 'no pricing found',
      });
      continue;
    }

    const { data: openNegotiation } = await supabase
      .from('negotiations')
      .select('id, quote_id')
      .eq('rfp_id', rfp.id)
      .eq('vendor_email', message.fromEmail)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let priorQuote: { id: string; total_amount: number } | null = null;

    if (openNegotiation?.quote_id) {
      const { data } = await supabase
        .from('quotes')
        .select('id, total_amount')
        .eq('id', openNegotiation.quote_id)
        .maybeSingle();
      priorQuote = data as any;
    }

    if (!priorQuote) {
      const { data } = await supabase
        .from('quotes')
        .select('id, total_amount')
        .eq('rfp_id', rfp.id)
        .eq('vendor_email', message.fromEmail)
        .neq('status', 'rejected')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      priorQuote = data as any;
    }

    const { error: insertError } = await supabase.from('quotes').insert({
      revision_of: priorQuote?.id ?? null,
      rfp_id: rfp.id,
      rfp_number: rfp.rfp_number,
      customer_email: customerEmail.toLowerCase(),
      vendor_email: message.fromEmail,
      vendor_name: parsed.vendor_name || message.from.split('<')[0].trim() || message.fromEmail,
      total_amount: parsed.total_amount,
      currency: parsed.currency || 'INR',
      delivery_days: parsed.delivery_days,
      payment_terms: parsed.payment_terms,
      warranty: parsed.warranty,
      line_items: parsed.line_items,
      notes: parsed.notes,
      source: 'email',
      raw_email_id: messageId,
      raw_text: message.bodyText.slice(0, 4000),
      confidence: parsed.confidence,
      status: 'received',
    });

    if (insertError) {
      console.error('[QUOTE SYNC] Insert failed:', insertError.message);
      result.skipped++;
      result.details.push({
        from: message.fromEmail,
        subject: message.subject,
        outcome: `could not save: ${insertError.message}`,
      });
      continue;
    }

    const improved =
      priorQuote && Number(priorQuote.total_amount) > parsed.total_amount
        ? Number(priorQuote.total_amount) - parsed.total_amount
        : 0;

    if (priorQuote) {
      await supabase.from('quotes').update({ status: 'rejected' }).eq('id', priorQuote.id);

      await supabase
        .from('negotiations')
        .update({ status: 'replied', replied_at: new Date().toISOString(), result_amount: parsed.total_amount })
        .eq('rfp_id', rfp.id)
        .eq('vendor_email', message.fromEmail)
        .eq('status', 'sent');
    }

    result.quotes_saved++;
    result.details.push({
      from: message.fromEmail,
      subject: message.subject,
      outcome: priorQuote
        ? improved > 0
          ? `revised quote, down by ${improved}`
          : 'revised quote'
        : 'quote saved',
      rfp_number: rfp.rfp_number,
      amount: parsed.total_amount,
    });

    if (rfp.status === 'draft' || rfp.status === 'sent') {
      await supabase.from('rfps').update({ status: 'quoting', updated_at: new Date().toISOString() }).eq('id', rfp.id);
      rfp.status = 'quoting';
    }
  }

  result.success = true;
  return result;
}
