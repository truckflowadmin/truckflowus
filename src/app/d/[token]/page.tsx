import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { FEATURES, loadCompanyFeatures } from '@/lib/features';
import DriverTabs from './DriverTabs';
import DriverSetup from './DriverSetup';

export default async function DriverHome({ params }: { params: { token: string } }) {
  const driver = await prisma.driver.findUnique({
    where: { accessToken: params.token },
    include: { company: true },
  });
  if (!driver || !driver.active) notFound();

  // If driver has already set up their account, redirect to login
  if (driver.pinSet) {
    redirect('/d/login');
  }

  // First-time setup: show the setup form
  return <DriverSetup token={params.token} driverName={driver.name} />;
}

// This function renders the full portal — called from /d/portal
export async function DriverPortalContent({ driverId }: { driverId: string }) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { company: true, assignedTruck: { select: { truckNumber: true } } },
  });
  if (!driver || !driver.active) notFound();

  // Resolve feature flags from the company's plan (single query).
  const has = await loadCompanyFeatures(driver.companyId);

  // Date boundaries (computed once)
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Run ALL independent queries in parallel for speed
  const [
    activeTickets,
    completedToday,
    availableJobs,
    upcomingJobs,
    timeOffRequests,
    completedTickets,
    completedJobs,
    driverDocuments,
    driverExpenses,
    driverTripSheets,
  ] = await Promise.all([
    // Active tickets (dispatched, in-progress, issue)
    prisma.ticket.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['DISPATCHED', 'IN_PROGRESS', 'ISSUE'] },
      },
      include: { customer: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),

    // Completed today count
    has(FEATURES.DRIVER_DAILY_STATS)
      ? prisma.ticket.count({
          where: {
            driverId: driver.id,
            status: 'COMPLETED',
            completedAt: { gte: todayStart },
          },
        })
      : Promise.resolve(0),

    // Available jobs (open for drivers, with open slots)
    prisma.job.findMany({
      where: {
        companyId: driver.companyId,
        openForDrivers: true,
        status: { in: ['CREATED', 'ASSIGNED'] },
      },
      include: {
        customer: { select: { name: true } },
        broker: { select: { name: true } },
        assignments: { select: { driverId: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).then((jobs) =>
      // Only show jobs that still have open slots and driver isn't already assigned
      jobs.filter((j) => {
        const maxSlots = j.requiredTruckCount || 1;
        const currentCount = j.assignments.length;
        const alreadyAssigned = j.assignments.some((a) => a.driverId === driver.id);
        return currentCount < maxSlots && !alreadyAssigned;
      })
    ),

    // Upcoming jobs — assigned to this driver, JS-filtered by assignment status
    // (status field not in generated Prisma client yet, so we filter post-query)
    prisma.job.findMany({
      where: {
        companyId: driver.companyId,
        assignments: {
          some: {
            driverId: driver.id,
          },
        },
      },
      include: {
        customer: { select: { name: true } },
        broker: { select: { name: true } },
        assignments: {
          where: { driverId: driver.id },
        },
        _count: { select: { tickets: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    }),

    // Time-off requests (current + future, plus last 30 days)
    prisma.timeOffRequest.findMany({
      where: {
        driverId: driver.id,
        endDate: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startDate: 'asc' },
      take: 100,
    }),

    // Last 7 days completed (for the Completed tab)
    prisma.ticket.findMany({
      where: {
        driverId: driver.id,
        status: 'COMPLETED',
        completedAt: { gte: sevenDaysAgo },
      },
      include: { customer: true },
      orderBy: { completedAt: 'desc' },
      take: 50,
    }),

    // Completed jobs — for bulk photo upload, JS-filtered by assignment status
    // (status field not in generated Prisma client yet, so we filter post-query)
    prisma.job.findMany({
      where: {
        assignments: {
          some: {
            driverId: driver.id,
          },
        },
      },
      include: {
        customer: { select: { name: true } },
        broker: { select: { name: true } },
        assignments: {
          where: { driverId: driver.id },
        },
        tickets: {
          where: { driverId: driver.id },
          select: {
            id: true,
            ticketNumber: true,
            photoUrl: true,
            status: true,
            hauledFrom: true,
            hauledTo: true,
            material: true,
            quantity: true,
            quantityType: true,
            truckNumber: true,
            ticketRef: true,
            date: true,
            driverNotes: true,
            dispatcherReviewedAt: true,
            scannedTons: true,
            scannedYards: true,
            scannedTicketNumber: true,
            scannedDate: true,
          },
          orderBy: { ticketNumber: 'asc' },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    }),

    // Driver documents (profile)
    prisma.driverDocument.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    }),

    // Driver expenses (last 100)
    prisma.expense.findMany({
      where: { driverId: driver.id },
      include: { truck: { select: { truckNumber: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    }),

    // Trip sheets that contain tickets for this driver
    prisma.tripSheet.findMany({
      where: {
        companyId: driver.companyId,
        tickets: { some: { driverId: driver.id } },
      },
      include: {
        broker: { select: { name: true } },
        tickets: {
          where: { driverId: driver.id },
          select: {
            id: true,
            ticketNumber: true,
            material: true,
            quantity: true,
            quantityType: true,
            ratePerUnit: true,
            hauledFrom: true,
            hauledTo: true,
            date: true,
            status: true,
          },
        },
      },
      orderBy: { weekEnding: 'desc' },
      take: 50,
    }),
  ]);

  // Fetch this driver's assignment-level status data via raw SQL
  // (generated Prisma client doesn't know about new columns: status, startedAt, etc.)
  // Wrapped in try/catch in case the migration hasn't been applied yet
  let rawAssignments: any[] = [];
  try {
    rawAssignments = await prisma.$queryRaw`
      SELECT ja.id, ja."jobId", ja."driverId", ja.status,
             ja."startedAt", ja."completedAt", ja."driverTimeSeconds", ja."lastResumedAt"
      FROM "JobAssignment" ja
      WHERE ja."driverId" = ${driver.id}
    `;
  } catch {
    // Fallback: status columns may not exist yet — fetch basic assignment data
    rawAssignments = await prisma.$queryRaw`
      SELECT ja.id, ja."jobId", ja."driverId"
      FROM "JobAssignment" ja
      WHERE ja."driverId" = ${driver.id}
    `;
  }
  const assignmentsByJobId = new Map<string, any>();
  for (const a of rawAssignments) {
    assignmentsByJobId.set(a.jobId, a);
  }

  // Filter upcoming/completed jobs using raw assignment status data
  const filteredUpcomingJobs = upcomingJobs.filter(j => {
    const a = assignmentsByJobId.get(j.id);
    const aStatus = a?.status ?? 'ASSIGNED';
    return aStatus === 'ASSIGNED' || aStatus === 'IN_PROGRESS';
  }).slice(0, 50);

  const filteredCompletedJobs = completedJobs.filter(j => {
    const a = assignmentsByJobId.get(j.id);
    return a?.status === 'COMPLETED';
  }).slice(0, 20);

  // Serialize for client component (Dates → ISO strings, Decimals → numbers)
  const serialize = (t: any) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    status: t.status,
    material: t.material,
    quantityType: t.quantityType,
    quantity: Number(t.quantity),
    hauledFrom: t.hauledFrom,
    hauledTo: t.hauledTo,
    truckNumber: t.truckNumber ?? null,
    ticketRef: t.ticketRef ?? null,
    date: t.date?.toISOString() ?? null,
    driverNotes: t.driverNotes,
    ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit) : null,
    completedAt: t.completedAt?.toISOString() ?? null,
    photoUrl: t.photoUrl ?? null,
    scannedTons: t.scannedTons ?? null,
    scannedYards: t.scannedYards ?? null,
    scannedTicketNumber: t.scannedTicketNumber ?? null,
    scannedDate: t.scannedDate ?? null,
    customer: t.customer ? { name: t.customer.name } : null,
  });

  const serializeJob = (j: any) => {
    // Use this driver's assignment-level status/timer from raw SQL data
    const myAssignment = assignmentsByJobId.get(j.id);

    return {
      id: j.id,
      jobNumber: j.jobNumber,
      name: j.name,
      // Use driver's assignment status, falling back to job-level for backward compat
      status: myAssignment?.status ?? j.status,
      hauledFrom: j.hauledFrom,
      hauledFromAddress: j.hauledFromAddress ?? null,
      hauledTo: j.hauledTo,
      hauledToAddress: j.hauledToAddress ?? null,
      material: j.material,
      truckNumber: j.truckNumber ?? null,
      quantityType: j.quantityType,
      totalLoads: j.totalLoads,
      completedLoads: j.completedLoads ?? 0,
      ticketCount: j._count?.tickets ?? 0,
      ratePerUnit: j.ratePerUnit ? Number(j.ratePerUnit) : null,
      date: j.date?.toISOString() ?? null,
      notes: j.notes,
      // Use driver's own timer, not the job-level timer
      driverTimeSeconds: myAssignment?.driverTimeSeconds ?? j.driverTimeSeconds ?? 0,
      lastResumedAt: (myAssignment?.lastResumedAt instanceof Date ? myAssignment.lastResumedAt.toISOString() : myAssignment?.lastResumedAt)
        ?? j.lastResumedAt?.toISOString() ?? null,
      startedAt: (myAssignment?.startedAt instanceof Date ? myAssignment.startedAt.toISOString() : myAssignment?.startedAt)
        ?? j.startedAt?.toISOString() ?? null,
      requiredTruckCount: j.requiredTruckCount ?? 1,
      assignmentCount: j.assignments?.length ?? (j.driverId ? 1 : 0),
      customer: j.customer ? { name: j.customer.name } : null,
      broker: j.broker ? { name: j.broker.name } : null,
    };
  };

  const serializeCompletedJob = (j: any) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    name: j.name,
    hauledFrom: j.hauledFrom,
    hauledTo: j.hauledTo,
    material: j.material,
    truckNumber: j.truckNumber ?? null,
    quantityType: j.quantityType,
    totalLoads: j.totalLoads,
    ticketCount: j.tickets?.length ?? 0,
    completedLoads: j.completedLoads ?? 0,
    ratePerUnit: j.ratePerUnit ? Number(j.ratePerUnit) : null,
    date: j.date?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
    driverTimeSeconds: j.driverTimeSeconds ?? 0,
    customer: j.customer ? { name: j.customer.name } : null,
    broker: j.broker ? { name: j.broker.name } : null,
    tickets: (j.tickets ?? []).map((t: any) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      photoUrl: t.photoUrl ?? null,
      status: t.status,
      hauledFrom: t.hauledFrom,
      hauledTo: t.hauledTo,
      material: t.material ?? '',
      quantity: Number(t.quantity),
      quantityType: t.quantityType,
      truckNumber: t.truckNumber ?? '',
      ticketRef: t.ticketRef ?? '',
      date: t.date?.toISOString() ?? null,
      driverNotes: t.driverNotes ?? '',
      dispatcherReviewedAt: t.dispatcherReviewedAt?.toISOString() ?? null,
      scannedTons: t.scannedTons ?? null,
      scannedYards: t.scannedYards ?? null,
      scannedTicketNumber: t.scannedTicketNumber ?? null,
      scannedDate: t.scannedDate ?? null,
    })),
  });

  const serializeTripSheet = (ts: any) => {
    const driverTickets = ts.tickets ?? [];
    const totalRevenue = driverTickets.reduce((sum: number, tk: any) => {
      const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
      return sum + rate * Number(tk.quantity);
    }, 0);
    return {
      id: ts.id,
      weekEnding: ts.weekEnding.toISOString(),
      status: ts.status,
      totalDue: ts.totalDue ? Number(ts.totalDue) : null,
      broker: ts.broker ? { name: ts.broker.name } : null,
      ticketCount: driverTickets.length,
      driverRevenue: Math.round(totalRevenue * 100) / 100,
    };
  };

  const serializeTimeOff = (r: any) => ({
    id: r.id,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    reason: r.reason,
    status: r.status,
    reviewNote: r.reviewNote,
  });

  return (
    <DriverTabs
      token={driver.accessToken}
      driverName={driver.name}
      companyName={driver.company.name}
      truckNumber={(driver as any).assignedTruck?.truckNumber ?? null}
      completedToday={completedToday}
      activeTickets={activeTickets.map(serialize)}
      completedTickets={completedTickets.map(serialize)}
      availableJobs={availableJobs.map(serializeJob)}
      upcomingJobs={filteredUpcomingJobs.map(serializeJob)}
      completedJobs={filteredCompletedJobs.map(serializeCompletedJob)}
      canReportIssues={has(FEATURES.DRIVER_ISSUE_REPORTING)}
      canUseMaps={has(FEATURES.DRIVER_MAPS)}
      canSeeDailyStats={has(FEATURES.DRIVER_DAILY_STATS)}
      canUploadPhotos={has(FEATURES.DRIVER_PHOTO_UPLOAD)}
      canAiExtract={has(FEATURES.DRIVER_AI_EXTRACTION)}
      canViewCompleted={has(FEATURES.VIEW_DRIVER_COMPLETED)}
      canClaimJobs={true}
      hasAssignedTruck={!!(driver as any).assignedTruckId}
      timeOffRequests={timeOffRequests.map(serializeTimeOff)}
      documents={driverDocuments.map((d: any) => ({
        id: d.id,
        docType: d.docType,
        label: d.label,
        fileUrl: d.fileUrl,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))}
      profile={{
        phone: driver.phone,
        email: driver.email ?? null,
        address: driver.address ?? null,
        city: driver.city ?? null,
        state: driver.state ?? null,
        zip: driver.zip ?? null,
        emergencyContactName: driver.emergencyContactName ?? null,
        emergencyContactPhone: driver.emergencyContactPhone ?? null,
      }}
      driverExpenses={driverExpenses.map((e: any) => ({
        id: e.id,
        date: e.date.toISOString(),
        amount: Number(e.amount),
        category: e.category,
        description: e.description,
        vendor: e.vendor,
        receiptUrl: e.receiptUrl,
        notes: e.notes,
        truckNumber: e.truck?.truckNumber ?? null,
      }))}
      tripSheets={driverTripSheets.map(serializeTripSheet)}
      payroll={{
        workerType: driver.workerType,
        payType: driver.payType,
        payRate: driver.payRate ? Number(driver.payRate) : null,
        nextPayDate: (driver as any).nextPayDate?.toISOString() ?? null,
      }}
    />
  );
}
