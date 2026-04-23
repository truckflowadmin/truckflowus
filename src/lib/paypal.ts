/**
 * PayPal REST API client for subscription management.
 *
 * Environment variables:
 *   PAYPAL_CLIENT_ID       — PayPal app client ID
 *   PAYPAL_CLIENT_SECRET   — PayPal app secret
 *   PAYPAL_WEBHOOK_ID      — Webhook ID for signature verification
 *   PAYPAL_MODE            — "sandbox" or "live" (default: sandbox)
 *   NEXT_PUBLIC_APP_URL    — Base URL for return/cancel links
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function getBaseUrl(): string {
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

// ---------------------------------------------------------------------------
// Auth — OAuth2 client credentials
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required');

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------
async function paypalRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal API ${method} ${path} failed: ${res.status} ${text}`);
  }

  // Some endpoints return 204 with no body
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Create a PayPal subscription and return the approval URL.
 * The dispatcher is redirected to this URL to complete payment.
 */
export async function createSubscription(opts: {
  paypalPlanId: string;
  companyId: string;
  companyName: string;
  email?: string;
}): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const data = await paypalRequest('POST', '/v1/billing/subscriptions', {
    plan_id: opts.paypalPlanId,
    custom_id: opts.companyId, // ties this subscription back to our company
    application_context: {
      brand_name: 'TruckFlowUS',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: `${appUrl}/api/paypal/callback?action=success&companyId=${opts.companyId}`,
      cancel_url: `${appUrl}/api/paypal/callback?action=cancel&companyId=${opts.companyId}`,
    },
    ...(opts.email && {
      subscriber: {
        email_address: opts.email,
        name: { given_name: opts.companyName },
      },
    }),
  });

  const approvalLink = data.links?.find((l: any) => l.rel === 'approve');
  if (!approvalLink) throw new Error('No approval URL returned from PayPal');

  return {
    subscriptionId: data.id,
    approvalUrl: approvalLink.href,
  };
}

/**
 * Get subscription details from PayPal.
 */
export async function getSubscription(subscriptionId: string): Promise<any> {
  return paypalRequest('GET', `/v1/billing/subscriptions/${subscriptionId}`);
}

/**
 * Suspend (pause) a PayPal subscription.
 */
export async function suspendSubscription(subscriptionId: string, reason?: string): Promise<void> {
  await paypalRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/suspend`, {
    reason: reason || 'Subscription paused by administrator',
  });
}

/**
 * Reactivate a suspended PayPal subscription.
 */
export async function activateSubscription(subscriptionId: string, reason?: string): Promise<void> {
  await paypalRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/activate`, {
    reason: reason || 'Subscription reactivated',
  });
}

/**
 * Cancel a PayPal subscription permanently.
 */
export async function cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
  await paypalRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    reason: reason || 'Subscription cancelled',
  });
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

/**
 * Verify a PayPal webhook signature.
 * Returns true if valid, false otherwise.
 */
export async function verifyWebhookSignature(opts: {
  headers: Record<string, string>;
  body: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn('[paypal] No PAYPAL_WEBHOOK_ID set — skipping verification');
    return process.env.NODE_ENV !== 'production'; // allow in dev
  }

  try {
    const data = await paypalRequest('POST', '/v1/notifications/verify-webhook-signature', {
      auth_algo: opts.headers['paypal-auth-algo'] || '',
      cert_url: opts.headers['paypal-cert-url'] || '',
      transmission_id: opts.headers['paypal-transmission-id'] || '',
      transmission_sig: opts.headers['paypal-transmission-sig'] || '',
      transmission_time: opts.headers['paypal-transmission-time'] || '',
      webhook_id: webhookId,
      webhook_event: JSON.parse(opts.body),
    });
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('[paypal] Webhook verification failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Plans (admin helpers)
// ---------------------------------------------------------------------------

/**
 * List all PayPal billing plans (useful for superadmin plan mapping).
 */
export async function listPlans(): Promise<any[]> {
  const data = await paypalRequest('GET', '/v1/billing/plans?page_size=20&total_required=true');
  return data.plans || [];
}
