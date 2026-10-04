import { createClient } from '@supabase/supabase-js';
import { gmailService } from '@/lib/gmailService';
import { getGmailTokens } from '@/lib/quoteSync';
import { checkUdyam } from '@/lib/gstVerify';
import { normaliseCategory, normaliseActivity } from '@/lib/msmeCompliance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface DeclarationResult {
  success: boolean;
  error?: string;
  scanned: number;
  updated: number;
  details: Array<{
    from: string;
    outcome: string;
    udyam_number?: string;
    msme_category?: string;
    udyam_activity?: string;
  }>;
}

const UDYAM_PATTERN = /UDYAM-[A-Z]{2}-\d{2}-\d{7}/i;

export function declarationRequestBody(vendorName: string, buyerCompany: string): string {
  return [
    `<p>Dear ${vendorName},</p>`,
    `<p>We are updating our supplier records to meet Section 43B(h) of the Income Tax Act and Section 15 of the MSMED Act, which govern how quickly we must pay you.</p>`,
    `<p>Could you reply to this email confirming:</p>`,
    `<ol>`,
    `<li>Your <b>Udyam Registration Number</b>, in the form UDYAM-XX-00-0000000</li>`,
    `<li>Your <b>category</b>: micro, small or medium</li>`,
    `<li>Your registered <b>activity</b>: manufacturing, service or trading</li>`,
    `</ol>`,
    `<p>If you are not registered under Udyam, simply reply saying so.</p>`,
    `<p>This is only so we pay you within the period the law requires. A plain reply in the body of the email is enough, and there is no form or portal to sign into.</p>`,
    `<p>Thank you,<br>${buyerCompany}</p>`,
  ].join('');
}

export function parseDeclaration(text: string): {
  udyam_number: string | null;
  msme_category: string | null;
  udyam_activity: string | null;
  not_registered: boolean;
} {
  const body = (text || '').replace(/\s+/g, ' ');
  const lower = body.toLowerCase();

  const udyamMatch = body.match(UDYAM_PATTERN);
  const udyam = udyamMatch ? checkUdyam(udyamMatch[0]) : null;

  let category: string | null = null;
  if (/\bmicro\b/i.test(lower)) category = 'micro';
  else if (/\bsmall\b/i.test(lower)) category = 'small';
  else if (/\bmedium\b/i.test(lower)) category = 'medium';

  let activity: string | null = null;
  if (/\btrad(?:er|ing)\b|\bwholesale\b|\bretail\b/i.test(lower)) activity = 'trading';
  else if (/\bmanufactur/i.test(lower)) activity = 'manufacturing';
  else if (/\bservice/i.test(lower)) activity = 'service';

  const notRegistered =
    /not\s+(?:udyam\s+)?registered|no\s+udyam|not\s+an?\s+msme|unregistered/i.test(lower);

  return {
    udyam_number: udyam?.valid ? udyam.udyam || null : null,
    msme_category: category ? normaliseCategory(category) : null,
    udyam_activity: activity ? normaliseActivity(activity) : null,
    not_registered: notRegistered,
  };
}

export async function syncDeclarations(
  userId: string,
  customerEmail: string,
  options: { days?: number; maxMessages?: number } = {}
): Promise<DeclarationResult> {
  const days = options.days ?? 30;
  const maxMessages = options.maxMessages ?? 25;
  const result: DeclarationResult = { success: true, scanned: 0, updated: 0, details: [] };

  const tokens = await getGmailTokens(userId);
  if (!tokens) {
    return { ...result, success: false, error: 'Gmail is not connected. Connect it in Settings first.' };
  }

  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, email, is_msme, msme_category, udyam_activity')
    .eq('customer_email', customerEmail.toLowerCase());

  if (!vendors || vendors.length === 0) {
    return result;
  }

  const byEmail = new Map(vendors.map((v) => [v.email.toLowerCase(), v]));
  const query = `newer_than:${days}d (udyam OR msme OR "micro" OR "small enterprise")`;
  const messageIds = await gmailService.listMessages(tokens, query, maxMessages);

  for (const messageId of messageIds || []) {
    const message = await gmailService.getMessage(tokens, messageId);
    if (!message) continue;

    result.scanned++;

    const senderEmail = (message.fromEmail || '').trim().toLowerCase();
    const vendor = byEmail.get(senderEmail);
    if (!vendor) continue;

    const parsed = parseDeclaration(message.bodyText || '');

    if (!parsed.udyam_number && !parsed.msme_category && !parsed.not_registered) {
      result.details.push({ from: senderEmail, outcome: 'no MSME details found in the reply' });
      continue;
    }

    const update: Record<string, any> = {
      msme_source: 'declaration',
      msme_declared_at: new Date().toISOString(),
      msme_evidence: `gmail:${messageId}`,
      msme_verified_at: new Date().toISOString(),
    };

    if (parsed.not_registered && !parsed.udyam_number) {
      update.is_msme = false;
      update.msme_category = 'not_registered';
    } else {
      if (parsed.udyam_number) update.udyam_number = parsed.udyam_number;
      if (parsed.msme_category) {
        update.msme_category = parsed.msme_category;
        update.is_msme = parsed.msme_category === 'micro' || parsed.msme_category === 'small';
      }
      if (parsed.udyam_activity) update.udyam_activity = parsed.udyam_activity;
    }

    const attempt = await supabase.from('vendors').update(update).eq('id', vendor.id);

    if (attempt.error) {
      const { msme_source, msme_declared_at, msme_evidence, udyam_activity, msme_category, ...legacy } = update;
      const retry = await supabase.from('vendors').update(legacy).eq('id', vendor.id);
      if (retry.error) {
        result.details.push({ from: senderEmail, outcome: `could not save: ${retry.error.message}` });
        continue;
      }
    }

    result.updated++;
    result.details.push({
      from: senderEmail,
      outcome: 'MSME status recorded from the supplier declaration',
      udyam_number: parsed.udyam_number || undefined,
      msme_category: update.msme_category || undefined,
      udyam_activity: parsed.udyam_activity || undefined,
    });

    await supabase.from('compliance_events').insert({
      customer_email: customerEmail.toLowerCase(),
      event: 'declaration_received',
      occurred_at: new Date().toISOString(),
      actor: senderEmail,
      note: `Udyam ${parsed.udyam_number || 'not given'}, category ${update.msme_category || 'not given'}`,
    });
  }

  return result;
}
