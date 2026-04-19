import { prisma } from './prisma';

// Notification types that correspond to driver actions
export const NOTIFICATION_TYPES = {
  JOB_STARTED: 'JOB_STARTED',
  JOB_PAUSED: 'JOB_PAUSED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  JOB_CLAIMED: 'JOB_CLAIMED',
  JOB_ISSUE: 'JOB_ISSUE',
  TICKET_STARTED: 'TICKET_STARTED',
  TICKET_COMPLETED: 'TICKET_COMPLETED',
  TICKET_ISSUE: 'TICKET_ISSUE',
  TICKET_UPDATED: 'TICKET_UPDATED',
  TICKET_PHOTO_UPLOADED: 'TICKET_PHOTO_UPLOADED',
  INSPECTION_EXPIRING: 'INSPECTION_EXPIRING',
  EXPENSE_SUBMITTED: 'EXPENSE_SUBMITTED',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

interface CreateNotificationInput {
  companyId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Insert a notification visible to all dispatchers/admins of the company.
 * Fire-and-forget — errors are logged but never thrown so the caller isn't
 * disrupted if the notification DB write fails.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        companyId: input.companyId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch (err) {
    console.error('[notifications] Failed to create notification:', err);
  }
}
