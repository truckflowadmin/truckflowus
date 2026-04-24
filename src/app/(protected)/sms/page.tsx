import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { MessagingHub } from './MessagingHub';

export default async function SmsPage({
  searchParams,
}: {
  searchParams: { tab?: string; page?: string; dir?: string; search?: string };
}) {
  const session = await requireSession();
  const tab = searchParams.tab || 'all';
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const dir = searchParams.dir || 'all'; // all, in, out
  const search = searchParams.search || '';
  const pageSize = 30;

  // Build SMS filter
  const smsWhere: any = { companyId: session.companyId };
  if (dir === 'in') smsWhere.direction = 'INBOUND';
  if (dir === 'out') smsWhere.direction = 'OUTBOUND';
  if (search) {
    smsWhere.OR = [
      { phone: { contains: search } },
      { message: { contains: search, mode: 'insensitive' } },
    ];
  }

  // For incoming/outgoing tabs, override direction filter
  const smsFilter = { ...smsWhere };
  if (tab === 'incoming') smsFilter.direction = 'INBOUND';
  if (tab === 'outgoing') smsFilter.direction = 'OUTBOUND';

  const [smsLogs, smsTotal] = await Promise.all([
    prisma.smsLog.findMany({
      where: smsFilter,
      include: { driver: { select: { name: true } }, broker: { select: { name: true } }, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.smsLog.count({ where: smsFilter }),
  ]);

  // Contacts for send form (drivers and customers only — brokers cannot receive SMS from dispatchers)
  const [drivers, customers] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // SMS stats
  const [smsInCount, smsOutCount] = await Promise.all([
    prisma.smsLog.count({ where: { companyId: session.companyId, direction: 'INBOUND' } }),
    prisma.smsLog.count({ where: { companyId: session.companyId, direction: 'OUTBOUND' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(smsTotal / pageSize));

  return (
    <MessagingHub
      tab={tab}
      page={page}
      totalPages={totalPages}
      dir={dir}
      search={search}
      smsLogs={smsLogs.map((l: any) => ({
        id: l.id,
        direction: l.direction,
        phone: l.phone,
        message: l.message,
        driverName: l.driver?.name || null,
        brokerName: l.broker?.name || null,
        customerName: l.customer?.name || null,
        success: l.success,
        error: l.error,
        createdAt: l.createdAt.toISOString(),
      }))}
      drivers={drivers}
      customers={customers}
      stats={{ incoming: smsInCount, outgoing: smsOutCount }}
    />
  );
}
