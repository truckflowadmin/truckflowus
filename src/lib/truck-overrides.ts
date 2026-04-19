import { prisma } from '@/lib/prisma';

export interface TruckOverride {
  payToName: string | null;
  dispatcherName: string | null;
}

/**
 * Given a list of ticket-level truck numbers, look up the Truck records
 * and return a map of truckNumber → { payToName, dispatcherName }.
 *
 * This ensures the trip-sheet "Pay To" and "Dispatcher" fields use
 * the values from the fleet profile, matched by the ticket's own truckNumber
 * (not the driver's currently-assigned truck).
 */
export async function getTruckOverrides(
  companyId: string,
  truckNumbers: string[],
): Promise<Map<string, TruckOverride>> {
  const unique = [...new Set(truckNumbers.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const trucks = await prisma.truck.findMany({
    where: { companyId, truckNumber: { in: unique } },
    select: { truckNumber: true, payToName: true, dispatcherName: true },
  });

  const map = new Map<string, TruckOverride>();
  for (const t of trucks) {
    map.set(t.truckNumber, {
      payToName: t.payToName ?? null,
      dispatcherName: t.dispatcherName ?? null,
    });
  }
  return map;
}
