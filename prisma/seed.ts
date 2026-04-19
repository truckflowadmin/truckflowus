/**
 * Seed script. Run: npm run db:seed
 * Idempotent — safe to re-run after schema changes.
 *
 * Creates:
 *   - 4 subscription plans (FREE, STARTER, PRO, ENTERPRISE) with default feature sets
 *   - 1 platform superadmin (no tenant)
 *   - 3 tenant companies on different plans, each with an admin, drivers, customers,
 *     and a few tickets on the primary tenant
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PLAN_SEED_DEFAULTS } from '../src/lib/features';

const prisma = new PrismaClient();

async function main() {
  // --- Plans --------------------------------------------------------------
  for (const p of PLAN_SEED_DEFAULTS) {
    await prisma.plan.upsert({
      where: { key: p.key },
      // Re-seed updates features so new VIEW_* flags are applied.
      // Superadmin can still override per-tenant via feature overrides.
      update: {
        name: p.name,
        description: p.description,
        sortOrder: p.sortOrder,
        features: p.features,
      },
      create: {
        key: p.key,
        name: p.name,
        description: p.description,
        priceMonthlyCents: p.priceMonthlyCents,
        maxDrivers: p.maxDrivers,
        maxTicketsPerMonth: p.maxTicketsPerMonth,
        features: p.features,
        sortOrder: p.sortOrder,
      },
    });
  }

  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'FREE' } });
  const starterPlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'STARTER' } });
  const proPlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'PRO' } });

  // --- Platform superadmin -----------------------------------------------
  // Remove old superadmin email if it exists
  await prisma.user.deleteMany({ where: { email: 'superadmin@truckflow.io' } });

  // Only create/update if the superadmin still exists or was never seeded.
  // If a superadmin deliberately deleted this user, don't recreate it.
  const saExists = await prisma.user.findUnique({ where: { email: 'truckflowadmin@gmail.com' } });
  const anySuperadmin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });

  // Create if: the user exists (update password), OR no superadmin exists yet (first seed)
  if (saExists || !anySuperadmin) {
    const saPasswordHash = await bcrypt.hash('Superadmin2026!', 10);
    await prisma.user.upsert({
      where: { email: 'truckflowadmin@gmail.com' },
      update: { passwordHash: saPasswordHash, role: 'SUPERADMIN', companyId: null },
      create: {
        email: 'truckflowadmin@gmail.com',
        name: 'Platform Admin',
        passwordHash: saPasswordHash,
        role: 'SUPERADMIN',
        companyId: null,
      },
    });
  }

  // --- Helper: only seed a tenant if it still exists or was never created.
  // If the superadmin deleted it, the row is gone and we skip re-creation.
  // We track "already seeded once" by checking if the user for that tenant
  // exists. If the company is gone but we never seeded it, we create it.
  // ---------------------------------------------------------------------

  // --- Primary tenant (Acme Hauling) -------------------------------------
  const acmeExists = await prisma.company.findUnique({ where: { id: 'seed-company' } });
  const acmeUserExists = await prisma.user.findUnique({ where: { email: 'admin@acmehauling.example' } });

  if (acmeExists) {
    // Company exists — update plan if needed
    await prisma.company.update({ where: { id: 'seed-company' }, data: { planId: proPlan.id } });
  }

  // Only create the full tenant + data if the company exists OR was never seeded before
  if (acmeExists || !acmeUserExists) {
    const company = acmeExists ?? await prisma.company.create({
      data: {
        id: 'seed-company',
        name: 'Acme Hauling Co.',
        address: '123 Industrial Way',
        city: 'Cape Coral',
        state: 'FL',
        zip: '33904',
        phone: '(239) 555-0100',
        email: 'dispatch@acmehauling.example',
        defaultRate: 85.0,
        planId: proPlan.id,
      },
    });

    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'admin@acmehauling.example' },
      update: { passwordHash, companyId: company.id, role: 'ADMIN' },
      create: {
        email: 'admin@acmehauling.example',
        name: 'Dispatch Admin',
        passwordHash,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    const driver1 = await prisma.driver.upsert({
      where: { accessToken: 'seed-driver-1-token' },
      update: {},
      create: {
        companyId: company.id,
        name: 'Mike Johnson',
        phone: '+12395550111',
        truckNumber: 'T-101',
        accessToken: 'seed-driver-1-token',
      },
    });
    const driver2 = await prisma.driver.upsert({
      where: { accessToken: 'seed-driver-2-token' },
      update: {},
      create: {
        companyId: company.id,
        name: 'Sarah Davis',
        phone: '+12395550222',
        truckNumber: 'T-102',
        accessToken: 'seed-driver-2-token',
      },
    });

    const cust1 = await prisma.customer.upsert({
      where: { id: 'seed-cust-1' },
      update: {},
      create: {
        id: 'seed-cust-1',
        companyId: company.id,
        name: 'Lee County Construction',
        contact: 'Bob Smith',
        phone: '(239) 555-0200',
        email: 'bob@leeconstruction.example',
        address: '456 Builder Blvd, Fort Myers, FL',
      },
    });
    const cust2 = await prisma.customer.upsert({
      where: { id: 'seed-cust-2' },
      update: {},
      create: {
        id: 'seed-cust-2',
        companyId: company.id,
        name: 'Sunshine Landscaping',
        contact: 'Jane Doe',
        phone: '(239) 555-0300',
        email: 'jane@sunshineland.example',
        address: '789 Palm Way, Cape Coral, FL',
      },
    });

    const existing = await prisma.ticket.count({ where: { companyId: company.id } });
    if (existing === 0) {
      await prisma.ticket.createMany({
        data: [
          {
            companyId: company.id,
            ticketNumber: 1001,
            customerId: cust1.id,
            driverId: driver1.id,
            status: 'COMPLETED',
            material: 'Fill Dirt',
            quantity: 3,
            hauledFrom: 'Pit #2, 500 Quarry Rd',
            hauledTo: '456 Builder Blvd, Fort Myers, FL',
            ratePerUnit: 85.0,
            completedAt: new Date(Date.now() - 86400000),
          },
          {
            companyId: company.id,
            ticketNumber: 1002,
            customerId: cust2.id,
            driverId: driver2.id,
            status: 'IN_PROGRESS',
            material: 'Crushed Stone #57',
            quantityType: 'TONS',
            quantity: 12,
            hauledFrom: 'Quarry A, 100 Rock Rd',
            hauledTo: '789 Palm Way, Cape Coral, FL',
            ratePerUnit: 18.0,
            dispatchedAt: new Date(),
            startedAt: new Date(),
          },
          {
            companyId: company.id,
            ticketNumber: 1003,
            customerId: cust1.id,
            status: 'PENDING',
            material: 'Topsoil',
            quantityType: 'YARDS',
            quantity: 8,
            hauledFrom: 'Yard 7',
            hauledTo: '456 Builder Blvd, Fort Myers, FL',
            ratePerUnit: 25.0,
          },
        ],
      });
    }

    // Seed common materials for this company
    const seedMaterials = ['Fill Dirt', 'Crushed Stone #57', 'Topsoil', 'Sand', 'Gravel', 'Shell Rock', 'Limerock'];
    for (const name of seedMaterials) {
      await prisma.material.upsert({
        where: { companyId_name: { companyId: company.id, name } },
        update: {},
        create: { companyId: company.id, name },
      });
    }
    // Seed sample brokers for this company
    const seedBrokers = [
      {
        id: 'seed-broker-1', name: 'T. Disney Trucking',
        contacts: [
          { name: 'Tim Disney', phone: '(813) 555-0600', email: 'tim@disneytruck.example', jobTitle: 'Owner' },
          { name: 'Sarah Disney', phone: '(813) 555-0601', email: 'sarah@disneytruck.example', jobTitle: 'Dispatch Manager' },
        ],
        email: 'tim@disneytruck.example', commissionPct: 10.0,
        mailingAddress: '6324 US HWY 301 S,\nRiverview, FL 33578',
      },
      {
        id: 'seed-broker-2', name: 'FL Aggregate Brokers',
        contacts: [
          { name: 'Maria Santos', phone: '(239) 555-0700', email: 'maria@flagg.example', jobTitle: 'Operations Director' },
        ],
        email: 'maria@flagg.example', commissionPct: 8.5, mailingAddress: null,
      },
    ];
    for (const b of seedBrokers) {
      await prisma.broker.upsert({
        where: { id: b.id },
        update: {},
        create: { id: b.id, companyId: company.id, name: b.name, contacts: b.contacts, email: b.email, commissionPct: b.commissionPct, mailingAddress: b.mailingAddress },
      });
    }

    console.log('  Acme (PRO):       admin@acmehauling.example / admin123');
  } else {
    console.log('  Acme: skipped (deleted by superadmin)');
  }

  // --- Extra tenants to exercise the superadmin UI -----------------------

  // Gulf Coast Hauling
  const gulfExists = await prisma.company.findUnique({ where: { id: 'seed-company-b' } });
  const gulfUserExists = await prisma.user.findUnique({ where: { email: 'admin@gulfcoasthaul.example' } });

  if (gulfExists || !gulfUserExists) {
    const tenantA = gulfExists ?? await prisma.company.create({
      data: {
        id: 'seed-company-b',
        name: 'Gulf Coast Hauling',
        city: 'Fort Myers',
        state: 'FL',
        phone: '(239) 555-0400',
        email: 'dispatch@gulfcoasthaul.example',
        defaultRate: 80.0,
        planId: starterPlan.id,
      },
    });
    if (gulfExists) {
      await prisma.company.update({ where: { id: 'seed-company-b' }, data: { planId: starterPlan.id } });
    }
    const tenantAPass = await bcrypt.hash('gulfadmin123', 10);
    await prisma.user.upsert({
      where: { email: 'admin@gulfcoasthaul.example' },
      update: { passwordHash: tenantAPass, companyId: tenantA.id, role: 'ADMIN' },
      create: {
        email: 'admin@gulfcoasthaul.example',
        name: 'Rick Alvarez',
        passwordHash: tenantAPass,
        role: 'ADMIN',
        companyId: tenantA.id,
      },
    });
    console.log('  Gulf Coast (STARTER): admin@gulfcoasthaul.example / gulfadmin123');
  } else {
    console.log('  Gulf Coast: skipped (deleted by superadmin)');
  }

  // Disney Trucking
  const disneyExists = await prisma.company.findUnique({ where: { id: 'seed-company-c' } });
  const disneyUserExists = await prisma.user.findUnique({ where: { email: 'admin@disneytruck.example' } });

  if (disneyExists || !disneyUserExists) {
    const tenantB = disneyExists ?? await prisma.company.create({
      data: {
        id: 'seed-company-c',
        name: 'Disney Trucking Inc.',
        city: 'Naples',
        state: 'FL',
        phone: '(239) 555-0500',
        email: 'ops@disneytruck.example',
        defaultRate: 90.0,
        planId: freePlan.id,
      },
    });
    if (disneyExists) {
      await prisma.company.update({ where: { id: 'seed-company-c' }, data: { planId: freePlan.id, suspended: false } });
    }
    const tenantBPass = await bcrypt.hash('disneyadmin123', 10);
    await prisma.user.upsert({
      where: { email: 'admin@disneytruck.example' },
      update: { passwordHash: tenantBPass, companyId: tenantB.id, role: 'ADMIN' },
      create: {
        email: 'admin@disneytruck.example',
        name: 'Tim Disney',
        passwordHash: tenantBPass,
        role: 'ADMIN',
        companyId: tenantB.id,
      },
    });
    console.log('  Disney (FREE):    admin@disneytruck.example / disneyadmin123');
  } else {
    console.log('  Disney: skipped (deleted by superadmin)');
  }

  console.log('✓ Seed complete');
  console.log('  Platform: truckflowadmin@gmail.com / Superadmin2026!  → /sa/overview');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
