/**
 * Twilio SMS client.
 *
 * Uses the Twilio REST API directly (no SDK) to send messages.
 * API: POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — your Twilio Account SID
 *   TWILIO_AUTH_TOKEN     — your Twilio Auth Token
 *   TWILIO_PHONE_NUMBER   — your Twilio phone number (E.164, e.g. +12395550100)
 *
 * For inbound replies, configure the Twilio phone number's webhook
 * to POST to: https://yourapp.com/api/sms/webhook
 */
import { prisma } from './prisma';

export interface SendSmsOptions {
  phone: string;              // E.164 e.g. +12395550111
  message: string;
  companyId?: string;
  driverId?: string;
  brokerId?: string;
  customerId?: string;
  ticketId?: string;
  jobId?: string;
  statusCallback?: string;    // URL Twilio calls with delivery status updates
}

export interface SendSmsResult {
  success: boolean;
  twilioSid?: string;         // Twilio Message SID (SM...)
  error?: string;
}

export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    const result: SendSmsResult = {
      success: false,
      error: 'Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)',
    };
    await logSms(opts, result);
    return result;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const body = new URLSearchParams({
    To: opts.phone,
    From: fromNumber,
    Body: opts.message,
  });
  if (opts.statusCallback) body.set('StatusCallback', opts.statusCallback);

  let result: SendSmsResult;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: body.toString(),
    });
    const data: any = await res.json();

    if (res.ok && data.sid) {
      result = {
        success: true,
        twilioSid: data.sid,
      };
    } else {
      result = {
        success: false,
        error: data.message || data.error_message || `HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    result = { success: false, error: err?.message || 'Network error' };
  }

  await logSms(opts, result);
  return result;
}

async function logSms(opts: SendSmsOptions, result: SendSmsResult) {
  await prisma.smsLog.create({
    data: {
      direction: 'OUTBOUND',
      phone: opts.phone,
      message: opts.message,
      companyId: opts.companyId,
      driverId: opts.driverId,
      brokerId: opts.brokerId,
      customerId: opts.customerId,
      ticketId: opts.ticketId,
      jobId: opts.jobId,
      textbeltId: result.twilioSid,  // reusing existing column for external message ID
      success: result.success,
      error: result.error,
    },
  });
}

const QTY_ABBR: Record<string, string> = { LOADS: 'load', TONS: 'ton', YARDS: 'yard' };

/**
 * Compose the SMS a driver receives when assigned to a ticket.
 */
export function composeAssignmentSms(params: {
  ticketNumber: number;
  material?: string | null;
  quantity: number;
  quantityType: string;
  hauledFrom: string;
  hauledTo: string;
  mobileUrl: string;
}): string {
  const { ticketNumber, material, quantity, quantityType, hauledFrom, hauledTo, mobileUrl } = params;
  const num = String(ticketNumber).padStart(4, '0');
  const mat = material ? `${material} • ` : '';
  const unit = QTY_ABBR[quantityType] || 'load';
  const qtyStr = `${quantity} ${unit}${quantity === 1 ? '' : 's'}`;
  return (
    `TruckFlowUS #${num}\n` +
    `${mat}${qtyStr}\n` +
    `From: ${hauledFrom}\n` +
    `To: ${hauledTo}\n` +
    `Details: ${mobileUrl}\n` +
    `Reply DONE when finished or ISSUE if there's a problem.`
  );
}

/**
 * Validate a Twilio webhook signature.
 * Twilio signs requests using HMAC-SHA1 of the full URL + sorted POST params.
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  // Build the data string: URL + sorted param keys with values concatenated
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // HMAC-SHA1 with auth token
  const { createHmac } = await import('crypto');
  const hmac = createHmac('sha1', authToken);
  hmac.update(data);
  const expected = hmac.digest('base64');

  return expected === signature;
}
