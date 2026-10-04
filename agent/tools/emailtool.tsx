import * as z from "zod";
import { tool } from "langchain";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { resolveGeneratedPdf, userOwnsGeneratedPdf, type GeneratedPdf } from "@/lib/generatedFiles";


const EnvSchema = z.object({
  SMTP_SERVER: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SENDER_EMAIL: z.string().optional(),
  SENDER_PASSWORD: z.string().optional(),
  SENDER_NAME: z.string().optional(),
  DEV_RECIPIENT: z.string().optional(),
});

const inputSchema = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject"),
  message: z.string().describe("Email body text or HTML content"),
  attachment_path: z.string().optional().describe("Optional file path to attach"),
  is_html: z.boolean().optional().describe("Whether the content is HTML (defaults to true)"),
});

type EmailInput = z.infer<typeof inputSchema>;

async function sendEmail(
  { to, subject, message, attachment_path, is_html = true }: EmailInput,
  config: any
) {
  // Try to get userId from config if not provided in parameters
  const actualUserId = config?.configurable?.userId;
  
  console.log('[EMAIL TOOL] sendEmail called with:', {
    actualUserId,
    has_attachment: !!attachment_path,
    attachment_path: attachment_path
  });
  
  // Use Gmail API only - no SMTP fallback
  if (!actualUserId) {
    return {
      success: false,
      error: 'User authentication required. User ID not found in request.',
    };
  }

  let attachment_file: GeneratedPdf | null = null;
  if (attachment_path) {
    const candidate = resolveGeneratedPdf(attachment_path);
    const customerEmail = String(config?.configurable?.customerEmail || '');
    if (candidate && (await userOwnsGeneratedPdf(candidate, customerEmail))) {
      attachment_file = candidate;
    }
  }

  try {
    const result = await sendViaGmailAPI(actualUserId, {
      subject,
      content: message,
      recipient_email: to,
      attachment_path,
      attachment_file,
      is_html,
    });
    
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to send email: ${error.message}. Please ensure Gmail is connected in Integrations.`,
    };
  }
}

async function sendViaGmailAPI(
  userId: string,
  emailData: {
    subject: string;
    content: string;
    recipient_email: string;
    attachment_path?: string;
    attachment_file?: GeneratedPdf | null;
    is_html: boolean;
  }
) {
  try {
    // Get user's Gmail tokens from database
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log('[EMAIL TOOL] Checking Gmail integration for userId:', userId);
    console.log('[EMAIL TOOL] Database connection details:', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
      key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? 'SET' : 'NOT SET'
    });

    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_type', 'gmail')
      .eq('is_active', true)
      .maybeSingle();

    console.log('[EMAIL TOOL] Query result:', { 
      integration: !!integration, 
      error: error?.message,
      userId_queried: userId,
      integration_details: integration ? {
        id: integration.id,
        user_id: integration.user_id,
        has_access_token: !!integration.access_token,
        has_refresh_token: !!integration.refresh_token,
        is_active: integration.is_active
      } : null
    });

    if (error) {
      console.error('[EMAIL TOOL] Database error:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!integration) {
      console.log('[EMAIL TOOL] No active Gmail integration found');
      return {
        success: false,
        error: 'Gmail integration not found or inactive. Please connect your Gmail account in Settings.',
      };
    }

    console.log('[EMAIL TOOL] Gmail integration found, proceeding with email send');

    // Check if token needs refresh
    let tokens = {
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };

    const { gmailService } = await import('@/lib/gmailService');

    // Refresh token if expired
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const newTokens = await gmailService.refreshAccessToken(tokens.refresh_token!);
      tokens = newTokens as any;

      // Update tokens in database
      await supabase
        .from('user_integrations')
        .update({
          access_token: newTokens.access_token,
          token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null,
        })
        .eq('id', integration.id);
    }

    // Prepare email data
    const emailPayload: any = {
      to: emailData.recipient_email,
      subject: emailData.subject,
      htmlBody: emailData.is_html ? emailData.content : `<p>${emailData.content}</p>`,
    };

    // Handle attachments
    if (emailData.attachment_path) {
      console.log('[EMAIL TOOL] Processing attachment:', emailData.attachment_path);
      
      const file = emailData.attachment_file;

      if (file) {
        const fileContent = fs.readFileSync(file.absPath);
        emailPayload.attachments = [{
          filename: file.name,
          content: fileContent.toString('base64'),
          encoding: 'base64',
        }];
        console.log('[EMAIL TOOL] Attachment added:', file.name, 'size:', fileContent.length, 'bytes');
      } else {
        console.log('[EMAIL TOOL] WARNING: Attachment refused or not found:', emailData.attachment_path);
      }
    } else {
      console.log('[EMAIL TOOL] No attachment_path provided');
    }

    // Send email via Gmail API
    const result = await gmailService.sendEmail(tokens, emailPayload);

    return {
      success: true,
      message: `Email sent via Gmail to ${emailData.recipient_email}`,
      details: { messageId: result.messageId, method: 'gmail_api' },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Gmail API error: ${error.message}`,
    };
  }
}

async function sendViaSMTP(emailData: {
  subject: string;
  content: string;
  recipient_email?: string;
  attachment_path?: string;
  is_html: boolean;
}) {
  // If env vars are not already set (running outside Next), try to load .env.local
  if (!process.env.SENDER_EMAIL || !process.env.SENDER_PASSWORD) {
    const envPath = path.resolve(process.cwd(), ".env.local");
    dotenv.config({ path: envPath });
  }

  const env = EnvSchema.parse(process.env);

  const host = env.SMTP_SERVER || "smtp.gmail.com";
  const port = Number(env.SMTP_PORT || 587);
  const user = env.SENDER_EMAIL;
  const pass = env.SENDER_PASSWORD;
  const name = env.SENDER_NAME || "Procurement Agent";

  if (!user || !pass) {
    return {
      success: false,
      error: "SMTP credentials are not set (SENDER_EMAIL or SENDER_PASSWORD missing)",
    };
  }

  const devRecipient = env.DEV_RECIPIENT;
  const to = devRecipient || emailData.recipient_email;
  if (!to) {
    return { success: false, error: "No recipient specified" };
  }

  // Compose mail
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports (use STARTTLS)
    auth: {
      user,
      pass,
    },
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: `${name} <${user}>`,
    to,
    subject: emailData.subject,
  };

  if (emailData.is_html) {
    mailOptions.html = emailData.content;
  } else {
    mailOptions.text = emailData.content;
  }

  if (emailData.attachment_path) {
    const file = resolveGeneratedPdf(emailData.attachment_path);
    if (!file) {
      return { success: false, error: 'Attachment not found.' };
    }
    mailOptions.attachments = [
      {
        filename: file.name,
        path: file.absPath,
      },
    ];
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      message: `Email sent via SMTP to ${to}`,
      details: { messageId: info.messageId, envelope: info.envelope, method: 'smtp' },
    };
  } catch (err) {
    console.error("sendEmail error:", err);
    return { success: false, error: (err as Error).message };
  }
}

export const emailTool = tool(sendEmail, {
  name: "send_email",
  description: `Send an email using Gmail API. 
  
User authentication is automatically handled - no need to provide user_id parameter.

Required parameters:
- to: recipient email address
- subject: email subject line
- message: email body content

Optional parameters:
- attachment_path: path to file attachment (e.g., PDF reports)
- is_html: set to true if message contains HTML (default: true)

always use professional, premium HTML and css formatting for better appearance
if needed use tabular structure for better clarity

The tool will automatically:
1. Use the authenticated user's Gmail account
2. Check if Gmail integration is active
3. Send email via Gmail API
4. Return success/failure status

Example usage:
- Send error report to manager
- Email RFP documents to vendors
- Forward procurement notifications`,
  schema: inputSchema,
});

export default emailTool;
