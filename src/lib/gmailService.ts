import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  date: string;
  bodyText: string;
  attachments: GmailAttachment[];
}

export class GmailService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/gmail/callback'
    );
  }

  // Generate OAuth URL for user consent
  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: userId, // Pass user ID to identify user after redirect
      prompt: 'consent',
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Set credentials for authenticated user
  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Send email via Gmail API
  async sendEmail(tokens: any, emailData: {
    to: string;
    subject: string;
    htmlBody: string;
    attachments?: Array<{ filename: string; content: string; encoding: string }>;
  }) {
    try {
      // Set user credentials
      this.setCredentials(tokens);

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Create email message
      const message = this.createMessage(emailData);

      // Send email
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });

      return {
        success: true,
        messageId: result.data.id,
      };
    } catch (error: any) {
      console.error('Gmail API Error:', error);
      throw new Error(`Failed to send email via Gmail: ${error.message}`);
    }
  }

  // Create RFC 2822 formatted message
  private createMessage(emailData: {
    to: string;
    subject: string;
    htmlBody: string;
    attachments?: Array<{ filename: string; content: string; encoding: string }>;
  }): string {
    const boundary = 'procurix_boundary_' + Date.now();
    
    let message = [
      `To: ${emailData.to}`,
      `Subject: ${emailData.subject}`,
      'MIME-Version: 1.0',
    ];

    if (emailData.attachments && emailData.attachments.length > 0) {
      message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      message.push('');
      message.push(`--${boundary}`);
    }

    message.push('Content-Type: text/html; charset=utf-8');
    message.push('');
    message.push(emailData.htmlBody);

    // Add attachments
    if (emailData.attachments && emailData.attachments.length > 0) {
      emailData.attachments.forEach(attachment => {
        message.push('');
        message.push(`--${boundary}`);
        message.push(`Content-Type: application/octet-stream; name="${attachment.filename}"`);
        message.push('Content-Transfer-Encoding: base64');
        message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        message.push('');
        message.push(attachment.content);
      });
      message.push('');
      message.push(`--${boundary}--`);
    }

    // Encode message to base64url
    const encodedMessage = Buffer.from(message.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedMessage;
  }

  async listMessages(tokens: any, query: string, maxResults = 25): Promise<string[]> {
    this.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    return (res.data.messages || []).map((m) => m.id!).filter(Boolean);
  }

  async getMessage(tokens: any, messageId: string): Promise<GmailMessage> {
    this.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const payload = res.data.payload;
    const headers = payload?.headers || [];
    const header = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const from = header('From');
    const emailMatch = from.match(/<([^>]+)>/);
    const fromEmail = (emailMatch ? emailMatch[1] : from).trim().toLowerCase();

    const bodyParts: string[] = [];
    const attachments: GmailAttachment[] = [];

    const walk = (part: any) => {
      if (!part) return;

      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          attachmentId: part.body.attachmentId,
          size: part.body.size || 0,
        });
      }

      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyParts.push(Buffer.from(part.body.data, 'base64').toString('utf8'));
      }

      if (Array.isArray(part.parts)) part.parts.forEach(walk);
    };

    walk(payload);

    if (bodyParts.length === 0 && payload?.body?.data) {
      bodyParts.push(Buffer.from(payload.body.data, 'base64').toString('utf8'));
    }

    return {
      id: messageId,
      threadId: res.data.threadId || '',
      from,
      fromEmail,
      subject: header('Subject'),
      date: header('Date'),
      bodyText: bodyParts.join('\n').slice(0, 20000),
      attachments,
    };
  }

  async getAttachment(tokens: any, messageId: string, attachmentId: string): Promise<string | null> {
    this.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (!res.data.data) return null;
    return res.data.data.replace(/-/g, '+').replace(/_/g, '/');
  }

  // Refresh access token if expired
  async refreshAccessToken(refreshToken: string) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error: any) {
      console.error('Token refresh error:', error);
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }
}

export const gmailService = new GmailService();
