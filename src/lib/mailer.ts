import { createClient } from '@supabase/supabase-js';
import { gmailService } from '@/lib/gmailService';
import { getGmailTokens } from '@/lib/quoteSync';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface MailResult {
  success: boolean;
  error?: string;
  messageId?: string | null;
  skipped?: 'no_user' | 'no_gmail';
}

export async function userIdFor(customerEmail: string): Promise<string | null> {
  const { data } = await supabase
    .from('userprofile')
    .select('id')
    .eq('email', customerEmail.toLowerCase())
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

export async function sendMailForUser(
  customerEmail: string,
  mail: { to?: string; subject: string; htmlBody: string }
): Promise<MailResult> {
  const userId = await userIdFor(customerEmail);

  if (!userId) {
    return { success: false, skipped: 'no_user', error: 'No user profile for ' + customerEmail };
  }

  let tokens;
  try {
    tokens = await getGmailTokens(userId);
  } catch (error: any) {
    return { success: false, error: 'Could not read the Gmail token: ' + error.message };
  }

  if (!tokens) {
    return { success: false, skipped: 'no_gmail', error: 'Gmail is not connected for ' + customerEmail };
  }

  try {
    const result = await gmailService.sendEmail(tokens, {
      to: mail.to || customerEmail,
      subject: mail.subject,
      htmlBody: mail.htmlBody,
    });

    return { success: !!result.success, messageId: result.messageId ?? null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
