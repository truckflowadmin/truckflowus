import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { MessagingHub } from './MessagingHub';

export default async function SmsAndFaxPage({
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

  // Build Fax filter
  const faxWhere: any = { companyId: session.companyId };
  if (dir === 'in') faxWhere.direction = 'INBOUND';
  if (dir === 'out') faxWhere.direction = 'OUTBOUND';
  if (search) {
    faxWhere.faxNumber = { contains: search };
  }

  // Fetch data based on tab
  let smsLogs: any[] = [];
  let faxLogs: any[] = [];
  let smsTotal = 0;
  let faxTotal = 0;

  if (tab === 'all' || tab === 'sms' || tab === 'incoming' || tab === 'outgoing') {
    // For incoming/outgoing tabs, override direction filter
    const smsFilter = { ...smsWhere };
    if (tab === 'incoming') smsFilter.direction = 'INBOUND';
    if (tab === 'outgoing') smsFilter.direction = 'OUTBOUND';

    [smsLogs, smsTotal] = await Promise.all([
      prisma.smsLog.findMany({
        where: smsFilter,
        include: { driver: { select: { name: true } }, broker: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsLog.count({ where: smsFilter }),
    ]);
  }

  if (tab === 'all' || tab === 'fax') {
    const faxFilter = { ...faxWhere };
    [faxLogs, faxTotal] = await Promise.all([
      prisma.faxLog.findMany({
        where: faxFilter,
        include: { driver: { select: { name: true } }, broker: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (tab === 'fax') ? (page - 1) * pageSize : 0,
        take: (tab === 'fax') ? pageSize : pageSize,
      }),
      prisma.faxLog.count({ where: faxFilter }),
    ]);
  }

  // Contacts for send forms
  const [drivers, brokers] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
    prisma.broker.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // SMS stats
  const [smsInCount, smsOutCount, faxCount] = await Promise.all([
    prisma.smsLog.count({ where: { companyId: session.companyId, direction: 'INBOUND' } }),
    prisma.smsLog.count({ where: { companyId: session.companyId, direction: 'OUTBOUND' } }),
    prisma.faxLog.count({ where: { companyId: session.companyId } }),
  ]);

  const totalMessages = tab === 'fax' ? faxTotal : smsTotal;
  const totalPages = Math.max(1, Math.ceil(totalMessages / pageSize));

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
        success: l.success,
        error: l.error,
        createdAt: l.createdAt.toISOString(),
      }))}
      faxLogs={faxLogs.map((f: any) => ({
        id: f.id,
        direction: f.direction,
        faxNumber: f.faxNumber,
        pages: f.pages,
        mediaUrl: f.mediaUrl,
        status: f.status,
        driverName: f.driver?.name || null,
        brokerName: f.broker?.name || null,
        error: f.error,
        createdAt: f.createdAt.toISOString(),
      }))}
      drivers={drivers}
      brokers={brokers}
      stats={{ incoming: smsInCount, outgoing: smsOutCount, fax: faxCount }}
    />
  );
}
