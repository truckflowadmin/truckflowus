/**
 * Email utility using nodemailer.
 *
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If SMTP_HOST is not set, emails are logged to console instead of sent.
 */
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null; // No SMTP configured — will log instead

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
  return transporter;
}

export interface SendEmailOpts {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[];
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ success: boolean; error?: string }> {
  const from = process.env.SMTP_FROM || 'noreply@truckflow.local';
  const t = getTransporter();

  if (!t) {
    console.log('[EMAIL] SMTP not configured. Would have sent:');
    console.log(`  To: ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Attachments: ${opts.attachments?.length ?? 0}`);
    return { success: true }; // Don't fail in dev
  }

  try {
    await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL] Send failed:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
