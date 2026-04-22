/**
 * Twilio Fax client.
 *
 * Uses the Twilio REST API directly (no SDK) to send faxes.
 * API: POST https://fax.twilio.com/v1/Faxes
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — your Twilio Account SID
 *   TWILIO_AUTH_TOKEN     — your Twilio Auth Token
 *   TWILIO_FAX_NUMBER    — your Twilio fax-capable number (E.164)
 *                          Falls back to TWILIO_PHONE_NUMBER if not set
 *
 * For inbound faxes, configure the Twilio fax number's webhook
 * to POST to: https://yourapp.com/api/fax/webhook
 */
import { prisma } from './prisma';

export interface SendFaxOptions {
  faxNumber: string;          // E.164 destination fax number
  mediaUrl: string;           // URL to a publicly accessible PDF
  companyId?: string;
  driverId?: string;
  brokerId?: string;
  statusCallback?: string;    // URL Twilio calls with fax status updates
}

export interface SendFaxResult {
  success: boolean;
  twilioSid?: string;
  error?: string;
}

export async function sendFax(opts: SendFaxOptions): Promise<SendFaxResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FAX_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    const result: SendFaxResult = {
      success: false,
      error: 'Twilio fax credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FAX_NUMBER)',
    };
    await logFax(opts, result);
    return result;
  }

  const url = `https://fax.twilio.com/v1/Faxes`;

  const body = new URLSearchParams({
    To: opts.faxNumber,
    From: fromNumber,
    MediaUrl: opts.mediaUrl,
  });
  if (opts.statusCallback) body.set('StatusCallback', opts.statusCallback);

  let result: SendFaxResult;
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

  await logFax(opts, result);
  return result;
}

async function logFax(opts: SendFaxOptions, result: SendFaxResult) {
  await prisma.faxLog.create({
    data: {
      direction: 'OUTBOUND',
      faxNumber: opts.faxNumber,
      mediaUrl: opts.mediaUrl,
      companyId: opts.companyId,
      driverId: opts.driverId,
      brokerId: opts.brokerId,
      twilioSid: result.twilioSid,
      status: result.success ? 'QUEUED' : 'FAILED',
      error: result.error,
    },
  });
}
