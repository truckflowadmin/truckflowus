/**
 * Backfill truckNumber on existing tickets from driver profiles.
 *
 * For every ticket that has a driver assigned but no truckNumber set,
 * this copies the driver's truckNumber onto the ticket.
 *
 * Also backfills truckNumber on jobs the same way.
 *
 * Run:  npx tsx scripts/backfill-truck-numbers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Backfill tickets
  const tickets = await prisma.ticket.findMany({
    where: {
      driverId: { not: null },
      truckNumber: null,
    },
    select: { id: true, ticketNumber: true, driverId: true },
  });

  console.log(`Found ${tickets.length} tickets with a driver but no truck number.`);

  let ticketUpdated = 0;
  for (const t of tickets) {
    const driver = await prisma.driver.findUnique({
      where: { id: t.driverId! },
      select: { truckNumber: true, name: true },
    });
    if (driver?.truckNumber) {
      await prisma.ticket.update({
        where: { id: t.id },
        data: { truckNumber: driver.truckNumber },
      });
      console.log(
        `  Ticket #${String(t.ticketNumber).padStart(4, '0')} → truck ${driver.truckNumber} (from ${driver.name})`
      );
      ticketUpdated++;
    }
  }
  console.log(`Updated ${ticketUpdated} tickets.\n`);

  // 2. Backfill jobs
  const jobs = await prisma.job.findMany({
    where: {
      driverId: { not: null },
      truckNumber: null,
    },
    select: { id: true, jobNumber: true, driverId: true },
  });

  console.log(`Found ${jobs.length} jobs with a driver but no truck number.`);

  let jobUpdated = 0;
  for (const j of jobs) {
    const driver = await prisma.driver.findUnique({
      where: { id: j.driverId! },
      select: { truckNumber: true, name: true },
    });
    if (driver?.truckNumber) {
      await prisma.job.update({
        where: { id: j.id },
        data: { truckNumber: driver.truckNumber },
      });
      console.log(
        `  Job #${j.jobNumber ? String(j.jobNumber).padStart(4, '0') : j.id} → truck ${driver.truckNumber} (from ${driver.name})`
      );
      jobUpdated++;
    }
  }
  console.log(`Updated ${jobUpdated} jobs.`);

  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
