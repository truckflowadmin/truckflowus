/**
 * SMS notification helpers with preference checks.
 *
 * Each function checks the recipient's smsEnabled + specific preference
 * before sending. If disabled, the call is a silent no-op.
 *
 * Note: SMS preference fields (smsEnabled, smsJobAssignment, etc.) are added
 * via migration but not yet in the generated Prisma client, so we use `as any`
 * casts when accessing them. After running `npx prisma generate` in prod/dev
 * these casts can be removed.
 */
import { prisma } from './prisma';
import { sendSms, composeAssignmentSms } from './sms';

function appUrl() {
  return process.env.APP_URL || 'http://localhost:3000';
}

/* ── Driver notifications ─────────────────────────────────────── */

/** Notify driver they've been assigned to a job */
export async function notifyDriverJobAssignment(params: {
  driverId: string;
  jobNumber: number;
  material?: string | null;
  quantity: number;
  quantityType: string;
  hauledFrom: string;
  hauledTo: string;
}) {
  const driver = await prisma.driver.findUnique({
    where: { id: params.driverId },
  }) as any;
  if (!driver?.phone || !driver.smsEnabled || !driver.smsJobAssignment) return;

  const mobileUrl = `${appUrl()}/d/${driver.accessToken}`;
  const message = composeAssignmentSms({
    ticketNumber: params.jobNumber,
    material: params.material,
    quantity: params.quantity,
    quantityType: params.quantityType,
    hauledFrom: params.hauledFrom,
    hauledTo: params.hauledTo,
    mobileUrl,
  });
  await sendSms({ phone: driver.phone, message, driverId: driver.id });
}

/** Notify driver their job status changed (completed, cancelled, etc.) */
export async function notifyDriverJobStatusChange(params: {
  driverId: string;
  jobNumber: number;
  newStatus: string;
  jobName?: string;
}) {
  const driver = await prisma.driver.findUnique({
    where: { id: params.driverId },
  }) as any;
  if (!driver?.phone || !driver.smsEnabled || !driver.smsJobStatusChange) return;

  const num = String(params.jobNumber).padStart(4, '0');
  const status = params.newStatus.replace(/_/g, ' ').toLowerCase();
  const message = `TruckFlowUS #${num}${params.jobName ? ` (${params.jobName})` : ''}\nJob status updated: ${status}`;
  await sendSms({ phone: driver.phone, message, driverId: driver.id });
}

/** Notify eligible drivers when a new job is created that they could self-assign to */
export async function notifyDriversNewJobAvailable(params: {
  companyId: string;
  jobNumber: number;
  material?: string | null;
  hauledFrom: string;
  hauledTo: string;
  requiredTruckType?: string | null;
}) {
  // Find drivers opted-in to new job notifications
  const where: any = {
    companyId: params.companyId,
    active: true,
    smsEnabled: true,
    smsNewJobAvailable: true,
    phone: { not: '' },
  };

  // If job requires a specific truck type, only notify drivers with matching trucks
  if (params.requiredTruckType) {
    where.assignedTruck = { truckType: params.requiredTruckType };
  }

  const drivers = await prisma.driver.findMany({
    where,
    select: { id: true, phone: true },
  });

  if (drivers.length === 0) return;

  const num = String(params.jobNumber).padStart(4, '0');
  const mat = params.material ? `${params.material} — ` : '';
  const message =
    `TruckFlowUS — New job available!\n` +
    `#${num} ${mat}${params.hauledFrom} → ${params.hauledTo}\n` +
    `Open the app to accept this job.`;

  await Promise.all(
    drivers.map((d) => sendSms({ phone: d.phone, message, driverId: d.id }))
  );
}

/** Notify driver that their payroll has been calculated */
export async function notifyDriverPayrollReady(params: {
  driverId: string;
  periodLabel: string;  // e.g. "Apr 14–20, 2026"
  totalAmount?: string; // e.g. "$1,234.56"
}) {
  const driver = await prisma.driver.findUnique({
    where: { id: params.driverId },
  }) as any;
  if (!driver?.phone || !driver.smsEnabled || !driver.smsPayrollReady) return;

  const mobileUrl = `${appUrl()}/d/${driver.accessToken}`;
  const amountLine = params.totalAmount ? `\nAmount: ${params.totalAmount}` : '';
  const message =
    `TruckFlowUS — Payroll ready\n` +
    `Period: ${params.periodLabel}${amountLine}\n` +
    `View details: ${mobileUrl}`;
  await sendSms({ phone: driver.phone, message, driverId: driver.id });
}

/* ── Dispatcher notifications ─────────────────────────────────── */

/** Notify dispatchers when a driver reports an issue */
export async function notifyDispatchersDriverIssue(params: {
  companyId: string;
  driverName: string;
  jobNumber: number;
  issueText?: string;
}) {
  const dispatchers = await (prisma.user.findMany as any)({
    where: {
      companyId: params.companyId,
      smsEnabled: true,
      smsDriverIssue: true,
      phone: { not: null },
    },
    select: { phone: true },
  });

  if (dispatchers.length === 0) return;

  const num = String(params.jobNumber).padStart(4, '0');
  const excerpt = params.issueText ? `\n"${params.issueText.substring(0, 80)}"` : '';
  const message = `TruckFlowUS Alert\n${params.driverName} reported an ISSUE on job #${num}${excerpt}`;

  await Promise.all(
    dispatchers
      .filter((d: any) => d.phone)
      .map((d: any) => sendSms({ phone: d.phone, message }))
  );
}

/** Notify dispatchers when a driver completes a job */
export async function notifyDispatchersDriverCompleted(params: {
  companyId: string;
  driverName: string;
  jobNumber: number;
}) {
  const dispatchers = await (prisma.user.findMany as any)({
    where: {
      companyId: params.companyId,
      smsEnabled: true,
      smsDriverCompleted: true,
      phone: { not: null },
    },
    select: { phone: true },
  });

  if (dispatchers.length === 0) return;

  const num = String(params.jobNumber).padStart(4, '0');
  const message = `TruckFlowUS\n${params.driverName} completed job #${num}`;

  await Promise.all(
    dispatchers
      .filter((d: any) => d.phone)
      .map((d: any) => sendSms({ phone: d.phone, message }))
  );
}

/** Notify dispatchers when a broker submits a new job via SMS */
export async function notifyDispatchersNewBrokerJob(params: {
  companyId: string;
  brokerName: string;
  jobNumber: number;
  hauledFrom?: string;
  hauledTo?: string;
}) {
  const dispatchers = await (prisma.user.findMany as any)({
    where: {
      companyId: params.companyId,
      smsEnabled: true,
      smsNewBrokerJob: true,
      phone: { not: null },
    },
    select: { phone: true },
  });

  if (dispatchers.length === 0) return;

  const num = String(params.jobNumber).padStart(4, '0');
  const route = params.hauledFrom && params.hauledTo ? `\n${params.hauledFrom} → ${params.hauledTo}` : '';
  const message = `TruckFlowUS — New job from broker\n${params.brokerName} submitted job #${num}${route}`;

  await Promise.all(
    dispatchers
      .filter((d: any) => d.phone)
      .map((d: any) => sendSms({ phone: d.phone, message }))
  );
}
