import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { checkRateLimit, recordAttempt } from '@/lib/rate-limit';

const CONTACT_EMAIL = 'truckflowadmin@gmail.com';

/** Escape HTML entities to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const VALID_CATEGORIES = [
  'Special Request',
  'Something Not Working',
  'General Inquiry',
  'Other',
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, category, message } = body;

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !category?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category.' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters.' },
        { status: 400 }
      );
    }

    if (message.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters).' },
        { status: 400 }
      );
    }

    // Rate limit: 5 contact form submissions per 15 minutes per IP
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rl = await checkRateLimit({
      key: ip,
      type: 'contact_form',
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many submissions. Please try again in ${rl.retryAfterMinutes} minutes.` },
        { status: 429 }
      );
    }

    // Record the attempt
    await recordAttempt(ip, 'contact_form', true);

    // Send email — escape all user inputs to prevent HTML injection
    const safeName = escapeHtml(name.trim());
    const safeEmail = escapeHtml(email.trim());
    const safeCategory = escapeHtml(category);
    const safeMessage = escapeHtml(message.trim());

    const subject = `[TruckFlowUS Contact] ${category} — from ${name.trim()}`;
    const text = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Category: ${category}`,
      '',
      'Message:',
      message.trim(),
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #f59e0b; margin-bottom: 20px;">New Contact Form Submission</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #666; width: 100px;">Name</td>
            <td style="padding: 8px 12px;">${safeName}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px 12px; font-weight: bold; color: #666;">Email</td>
            <td style="padding: 8px 12px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #666;">Category</td>
            <td style="padding: 8px 12px;">${safeCategory}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          <p style="font-weight: bold; color: #666; margin: 0 0 8px;">Message:</p>
          <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
        </div>
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">Sent from the TruckFlowUS contact form</p>
      </div>
    `;

    const result = await sendEmail({
      to: CONTACT_EMAIL,
      subject,
      text,
      html,
    });

    if (!result.success) {
      console.error('[CONTACT] Email send failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to send message. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[CONTACT] Error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
