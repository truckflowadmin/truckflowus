/**
 * Textbelt SMS client.
 *
 * Textbelt API: https://textbelt.com/
 *   POST https://textbelt.com/text
 *   body: { phone, message, key, replyWebhookUrl? }
 *   response: { success, textId, quotaRemaining, error? }
 *
 * For inbound replies, Textbelt calls our webhook URL as POST with JSON:
 *   { textId, fromNumber, text }
 */
import { prisma } from './prisma';

const TEXTBELT_URL = 'https://textbelt.com/text';

export interface SendSmsOptions {
  phone: string;              // E.164 e.g. +12395550111
  message: string;
  driverId?: string;
  ticketId?: string;
  replyWebhookUrl?: string;   // full public URL for inbound replies
}

export interface SendSmsResult {
  success: boolean;
  textbeltId?: string;
  quotaRemaining?: number;
  error?: string;
}

export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  const key = process.env.TEXTBELT_KEY || 'textbelt_test';
  const payload: Record<string, string> = {
    phone: opts.phone,
    message: opts.message,
    key,
  };
  if (opts.replyWebhookUrl) payload.replyWebhookUrl = opts.replyWebhookUrl;

  let result: SendSmsResult;
  try {
    const res = await fetch(TEXTBELT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload).toString(),
    });
    const data: any = await res.json();
    result = {
      success: !!data.success,
      textbeltId: data.textId ? String(data.textId) : undefined,
      quotaRemaining: typeof data.quotaRemaining === 'number' ? data.quotaRemaining : undefined,
      error: data.error,
    };
  } catch (err: any) {
    result = { success: false, error: err?.message || 'Network error' };
  }

  // Persist every outbound attempt
  await prisma.smsLog.create({
    data: {
      direction: 'OUTBOUND',
      phone: opts.phone,
      message: opts.message,
      driverId: opts.driverId,
      ticketId: opts.ticketId,
      textbeltId: result.textbeltId,
      success: result.success,
      error: result.error,
    },
  });

  return result;
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
