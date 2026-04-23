/**
 * Billing email notifications.
 *
 * Sends transactional emails for billing events:
 *   - payment_received   — confirmation with amount and next billing date
 *   - payment_failed     — warning with retry/update payment info
 *   - trial_ending       — reminder 3 days before trial expires
 *   - account_suspended  — notice that access has been restricted
 */

import { prisma } from './prisma';
import { sendEmail } from './email';

export type BillingEmailType =
  | 'payment_received'
  | 'payment_failed'
  | 'trial_ending'
  | 'account_suspended';

interface PaymentDetails {
  amountCents?: number;
  transactionId?: string | null;
  nextPaymentDue?: Date | null;
  trialEndsAt?: Date | null;
}

/**
 * Send a billing notification email to the tenant's email address.
 * Silently fails if no email is configured or SMTP is not set up.
 */
export async function sendBillingEmail(
  companyId: string,
  type: BillingEmailType,
  details?: PaymentDetails,
): Promise<void> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true, plan: { select: { name: true } } },
    });

    if (!company?.email) {
      console.log(`[billing-email] No email for company ${companyId}, skipping ${type}`);
      return;
    }

    const { subject, html } = buildEmail(type, {
      companyName: company.name,
      planName: company.plan?.name || 'your plan',
      ...details,
    });

    await sendEmail({
      to: company.email,
      subject,
      html,
    });

    console.log(`[billing-email] Sent ${type} to ${company.email}`);
  } catch (err) {
    console.error(`[billing-email] Failed to send ${type} for ${companyId}:`, err);
    // Don't throw — billing emails are non-critical
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

interface TemplateVars {
  companyName: string;
  planName: string;
  amountCents?: number;
  transactionId?: string | null;
  nextPaymentDue?: Date | null;
  trialEndsAt?: Date | null;
}

function buildEmail(type: BillingEmailType, vars: TemplateVars): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckflowus.com';
  const amount = vars.amountCents ? `$${(vars.amountCents / 100).toFixed(2)}` : '';
  const nextDue = vars.nextPaymentDue
    ? vars.nextPaymentDue.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const trialEnd = vars.trialEndsAt
    ? vars.trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  switch (type) {
    case 'payment_received':
      return {
        subject: `TruckFlowUS — Payment Received (${amount})`,
        html: wrap(`
          <h2 style="color:#1a1a2e;margin-bottom:16px;">Payment Received</h2>
          <p>Hi <strong>${esc(vars.companyName)}</strong>,</p>
          <p>We received your payment of <strong>${amount}</strong> for the <strong>${esc(vars.planName)}</strong> plan. Thank you!</p>
          ${vars.transactionId ? `<p style="color:#666;font-size:13px;">PayPal Transaction ID: ${esc(vars.transactionId)}</p>` : ''}
          ${nextDue ? `<p>Your next billing date is <strong>${nextDue}</strong>.</p>` : ''}
          <div style="margin:24px 0;">
            <a href="${appUrl}/settings" style="background:#f5a623;color:#1a1a2e;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">View Your Account</a>
          </div>
          <p style="color:#888;font-size:12px;">This is an automated receipt from TruckFlowUS. Keep this for your records.</p>
        `),
      };

    case 'payment_failed':
      return {
        subject: 'TruckFlowUS — Payment Failed — Action Required',
        html: wrap(`
          <h2 style="color:#c0392b;margin-bottom:16px;">Payment Failed</h2>
          <p>Hi <strong>${esc(vars.companyName)}</strong>,</p>
          <p>We were unable to process your payment for the <strong>${esc(vars.planName)}</strong> plan. This usually happens when your payment method on file has expired or has insufficient funds.</p>
          <p><strong>What happens next:</strong></p>
          <ul style="color:#333;line-height:1.8;">
            <li>PayPal will automatically retry the payment</li>
            <li>If payment is not received within your grace period, your account may be suspended</li>
            <li>Your existing data will not be deleted, but dispatchers and drivers will lose access</li>
          </ul>
          <p><strong>To fix this:</strong> Log into your PayPal account and update your payment method, or contact us for help.</p>
          <div style="margin:24px 0;">
            <a href="${appUrl}/settings" style="background:#c0392b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Update Payment Method</a>
          </div>
        `),
      };

    case 'trial_ending':
      return {
        subject: 'TruckFlowUS — Your Trial Ends Soon',
        html: wrap(`
          <h2 style="color:#1a1a2e;margin-bottom:16px;">Your Trial Is Ending Soon</h2>
          <p>Hi <strong>${esc(vars.companyName)}</strong>,</p>
          <p>Your free trial of TruckFlowUS will end on <strong>${trialEnd || 'soon'}</strong>.</p>
          <p>To continue using all features without interruption, subscribe to a plan before your trial expires. Your data, drivers, and tickets will all be preserved.</p>
          <p><strong>If you don't subscribe:</strong></p>
          <ul style="color:#333;line-height:1.8;">
            <li>You will be redirected to the plans page when you log in</li>
            <li>Your account data will be safely stored and waiting for you</li>
            <li>You can subscribe at any time to restore full access</li>
          </ul>
          <div style="margin:24px 0;">
            <a href="${appUrl}/subscribe" style="background:#f5a623;color:#1a1a2e;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Choose a Plan</a>
          </div>
        `),
      };

    case 'account_suspended':
      return {
        subject: 'TruckFlowUS — Account Suspended',
        html: wrap(`
          <h2 style="color:#c0392b;margin-bottom:16px;">Account Suspended</h2>
          <p>Hi <strong>${esc(vars.companyName)}</strong>,</p>
          <p>Your TruckFlowUS account has been suspended due to a billing issue. Dispatchers and drivers will not be able to access the system until this is resolved.</p>
          <p><strong>Your data is safe.</strong> Nothing has been deleted. Once your subscription is reactivated, everything will be exactly as you left it.</p>
          <p><strong>To reactivate your account:</strong></p>
          <ul style="color:#333;line-height:1.8;">
            <li>Log in and subscribe to a plan</li>
            <li>Or contact us at support@truckflowus.com for help</li>
          </ul>
          <div style="margin:24px 0;">
            <a href="${appUrl}/subscribe" style="background:#f5a623;color:#1a1a2e;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Reactivate Your Account</a>
          </div>
        `),
      };
  }
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;padding:20px 24px;text-align:center;">
      <span style="color:#f5a623;font-weight:bold;font-size:18px;letter-spacing:1px;">TruckFlowUS</span>
    </div>
    <div style="padding:24px 28px;color:#333;font-size:14px;line-height:1.6;">
      ${content}
    </div>
    <div style="background:#f9f9f9;padding:16px 28px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;color:#999;font-size:11px;">
        TruckFlowUS &middot; Dump Truck Dispatch Software<br />
        <a href="https://truckflowus.com" style="color:#999;">truckflowus.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
