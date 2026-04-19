import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { requirePlan } from '@/lib/plan-gate';
import { loadCompanyFeatures, FEATURES } from '@/lib/features';
import FleetPageTabs from './FleetPageTabs';
import TrucksSection from './TrucksSection';
import ExpensesSection from './ExpensesSection';
import MaintenanceSection from './MaintenanceSection';
import InspectionAlerts from './InspectionAlerts';

export default async function FleetPage() {
  const session = await requireSession();
  const companyId = session.companyId;
  await requirePlan(companyId);

  const has = await loadCompanyFeatures(companyId);
  if (!has(FEATURES.VIEW_FLEET)) redirect('/locked?tab=Fleet');

  const showExpenses = has(FEATURES.FLEET_EXPENSES);
  const showMaintenance = has(FEATURES.MAINTENANCE_TRACKING);

  const [trucks, expenses] = await Promise.all([
    prisma.truck.findMany({
      where: { companyId },
      include: {
        photos: { orderBy: { createdAt: 'desc' } },
        filters: true,
        _count: { select: { expenses: true } },
      },
      orderBy: { truckNumber: 'asc' },
    }),
    prisma.expense.findMany({
      where: { companyId },
      include: { truck: { select: { id: true, truckNumber: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    }),
  ]);

  const serializedTrucks = trucks.map((t) => ({
    id: t.id,
    truckNumber: t.truckNumber,
    vin: t.vin,
    year: t.year,
    make: t.make,
    model: t.model,
    licensePlate: t.licensePlate,
    registrationExpiry: t.registrationExpiry?.toISOString() ?? null,
    insuranceExpiry: t.insuranceExpiry?.toISOString() ?? null,
    inspectionExpiry: t.inspectionExpiry?.toISOString() ?? null,
    status: t.status,
    truckType: t.truckType,
    notes: t.notes,
    photos: t.photos.map((p) => ({ id: p.id, docType: p.docType, label: p.label, fileUrl: p.fileUrl })),
    expenseCount: t._count.expenses,
    createdAt: t.createdAt.toISOString(),
  }));

  const serializedMaintenance = trucks.map((t) => ({
    id: t.id,
    truckNumber: t.truckNumber,
    year: t.year,
    make: t.make,
    model: t.model,
    status: t.status,
    engineMake: (t as any).engineMake ?? null,
    engineModel: (t as any).engineModel ?? null,
    engineSerial: (t as any).engineSerial ?? null,
    transmissionMake: (t as any).transmissionMake ?? null,
    transmissionModel: (t as any).transmissionModel ?? null,
    transmissionSerial: (t as any).transmissionSerial ?? null,
    rearEndMake: (t as any).rearEndMake ?? null,
    rearEndModel: (t as any).rearEndModel ?? null,
    rearEndRatio: (t as any).rearEndRatio ?? null,
    rearEndSerial: (t as any).rearEndSerial ?? null,
    oilType: (t as any).oilType ?? null,
    oilBrand: (t as any).oilBrand ?? null,
    filters: ((t as any).filters || []).map((f: any) => ({
      id: f.id,
      filterType: f.filterType,
      partNumber: f.partNumber,
      lastReplacedAt: f.lastReplacedAt?.toISOString() ?? null,
      nextDueAt: f.nextDueAt?.toISOString() ?? null,
      mileage: f.mileage ?? null,
      nextDueMileage: f.nextDueMileage ?? null,
      notes: f.notes,
    })),
  }));

  const serializedExpenses = expenses.map((e) => ({
    id: e.id,
    truckId: e.truckId,
    truckNumber: e.truck?.truckNumber ?? null,
    date: e.date.toISOString(),
    amount: Number(e.amount),
    category: e.category,
    description: e.description,
    vendor: e.vendor,
    receiptUrl: e.receiptUrl,
    isRecurring: e.isRecurring,
    recurringDay: e.recurringDay,
    recurringEnd: e.recurringEnd?.toISOString() ?? null,
    notes: e.notes,
  }));

  const truckOptions = trucks.map((t) => ({ id: t.id, truckNumber: t.truckNumber }));

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Fleet</h1>
        <p className="text-steel-500 mt-1">Manage your trucks, documents, and expenses</p>
      </header>

      <InspectionAlerts />

      <Suspense fallback={<div className="text-steel-400">Loading...</div>}>
        <FleetPageTabs
          trucksContent={<TrucksSection initialTrucks={serializedTrucks} />}
          expensesContent={showExpenses ? <ExpensesSection initialExpenses={serializedExpenses} trucks={truckOptions} /> : null}
          maintenanceContent={showMaintenance ? <MaintenanceSection initialTrucks={serializedMaintenance} /> : null}
        />
      </Suspense>
    </div>
  );
}
