'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

interface MaterialEntry {
  name: string;
  pricePerUnit: number | null;
  unit: string;
  notes: string;
}

export async function updateQuarry(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get('id') || '');

  const existing = await prisma.quarry.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!existing) return { success: false, error: 'Not found' };

  const name = String(formData.get('name') || '').trim();
  if (!name) return { success: false, error: 'Name is required' };

  const materialsJson = String(formData.get('materials') || '[]');
  let materials: MaterialEntry[] = [];
  try { materials = JSON.parse(materialsJson); } catch { /* empty */ }

  await prisma.quarry.update({
    where: { id },
    data: {
      name,
      phone: String(formData.get('phone') || '').trim() || null,
      email: String(formData.get('email') || '').trim() || null,
      contactPerson: String(formData.get('contactPerson') || '').trim() || null,
      website: String(formData.get('website') || '').trim() || null,
      pricingUrl: String(formData.get('pricingUrl') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
      city: String(formData.get('city') || '').trim() || null,
      state: String(formData.get('state') || '').trim() || null,
      zip: String(formData.get('zip') || '').trim() || null,
      lat: formData.get('lat') ? parseFloat(String(formData.get('lat'))) : null,
      lng: formData.get('lng') ? parseFloat(String(formData.get('lng'))) : null,
      hoursOfOp: String(formData.get('hoursOfOp') || '').trim() || null,
      materials: materials as any,
      notes: String(formData.get('notes') || '').trim() || null,
    },
  });

  revalidatePath('/quarries');
  return { success: true };
}

/* ── Default quarry directory for new companies ────── */
const DEFAULT_QUARRIES = [
  {
    name: 'Vulcan Materials - Naples',
    phone: '(239) 455-4550',
    website: 'https://www.vulcanmaterials.com',
    address: '3825 White Lake Blvd', city: 'Naples', state: 'FL', zip: '34117',
    lat: 26.1475, lng: -81.6200,
    hoursOfOp: 'Mon-Fri 6:00am - 4:30pm',
    materials: [
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Rip Rap', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Crush & Run', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Asphalt', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Major regional supplier. Call for current pricing.',
  },
  {
    name: 'Bonness Company',
    phone: '(239) 597-6221',
    website: 'https://www.bonness.com',
    address: '1990 Seward Ave', city: 'Naples', state: 'FL', zip: '34109',
    lat: 26.2280, lng: -81.7660,
    hoursOfOp: 'Mon-Fri 7:00am - 5:00pm',
    materials: [
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Shell Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Also provides site work & paving.',
  },
  {
    name: 'Florida Rock Industries - Ft. Myers',
    phone: '(239) 334-0773',
    website: 'https://www.patriottrans.com',
    address: '2301 Widman Way', city: 'Fort Myers', state: 'FL', zip: '33901',
    lat: 26.6337, lng: -81.8546,
    hoursOfOp: 'Mon-Fri 6:30am - 4:30pm',
    materials: [
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Rip Rap', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Concrete', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Shell Rock', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: null,
  },
  {
    name: 'Titan America - Pennsuco',
    phone: '(305) 364-2200',
    website: 'https://www.titanamerica.com',
    address: '11600 NW South River Dr', city: 'Medley', state: 'FL', zip: '33178',
    lat: 25.8580, lng: -80.3500,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm, Sat 6:00am - 12:00pm',
    materials: [
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Rip Rap', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Concrete', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Large mining operation with on-site concrete batch plant.',
  },
  {
    name: 'White Rock Quarries',
    phone: '(305) 821-8402',
    website: 'https://www.whiterockquarries.com',
    address: '8500 NW 166th St', city: 'Miami Lakes', state: 'FL', zip: '33016',
    lat: 25.9230, lng: -80.3310,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Crush & Run', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Rip Rap', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: null,
  },
  {
    name: 'APAC Southeast - Lehigh Acres',
    phone: '(239) 369-1161',
    address: '901 Leeland Heights Blvd', city: 'Lehigh Acres', state: 'FL', zip: '33936',
    lat: 26.5980, lng: -81.6270,
    hoursOfOp: 'Mon-Fri 6:00am - 4:00pm',
    materials: [
      { name: 'Asphalt Millings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Crush & Run', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Specializes in asphalt & road base materials.',
  },
  {
    name: 'CEMEX - Fort Myers',
    phone: '(239) 332-1440',
    website: 'https://www.cemexusa.com',
    address: '3350 Metro Pkwy', city: 'Fort Myers', state: 'FL', zip: '33916',
    lat: 26.5920, lng: -81.8350,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm, Sat 7:00am - 12:00pm',
    materials: [
      { name: 'Concrete', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Gravel', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Ready-mix concrete plant. Aggregates available.',
  },
  {
    name: 'Vulcan Materials - Fort Myers',
    phone: '(239) 337-2202',
    website: 'https://www.vulcanmaterials.com',
    address: '5600 Division Dr', city: 'Fort Myers', state: 'FL', zip: '33905',
    lat: 26.6510, lng: -81.7950,
    hoursOfOp: 'Mon-Fri 6:00am - 4:30pm',
    materials: [
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Rip Rap', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Granite', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Asphalt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: null,
  },
  {
    name: 'Quality Enterprises USA',
    phone: '(239) 435-7200',
    website: 'https://www.qualityenterprises.net',
    address: '3894 Mannix Dr Suite 216', city: 'Naples', state: 'FL', zip: '34114',
    lat: 26.1100, lng: -81.7480,
    hoursOfOp: 'Mon-Fri 7:00am - 5:00pm',
    materials: [
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Shell Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Utility & site work contractor with quarry operations.',
  },
  {
    name: 'Ranger Construction - Palm Beach',
    phone: '(561) 793-9400',
    website: 'https://www.rangerconstruction.com',
    address: '230 S State Rd 7', city: 'West Palm Beach', state: 'FL', zip: '33413',
    lat: 26.6640, lng: -80.1520,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Asphalt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Asphalt Millings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Asphalt production & aggregate supply.',
  },
  {
    name: 'Martin Marietta Materials - Clewiston',
    phone: '(863) 983-6161',
    website: 'https://www.martinmarietta.com',
    address: 'Hwy 27', city: 'Clewiston', state: 'FL', zip: '33440',
    lat: 26.7540, lng: -80.9340,
    hoursOfOp: 'Mon-Fri 6:00am - 4:00pm',
    materials: [
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Rip Rap', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Screenings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Crush & Run', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Large inland quarry. Delivery available.',
  },
  {
    name: 'Bergeron Land Development',
    phone: '(954) 584-0192',
    address: '4455 SW 64th Ave', city: 'Davie', state: 'FL', zip: '33314',
    lat: 26.0630, lng: -80.2300,
    hoursOfOp: 'Mon-Fri 6:30am - 4:30pm',
    materials: [
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Shell Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Active rock mine in Broward County.',
  },
  {
    name: 'Preferred Materials - Pompano',
    phone: '(954) 917-2217',
    website: 'https://www.preferredmaterials.com',
    address: '1300 NW 23rd Ave', city: 'Pompano Beach', state: 'FL', zip: '33069',
    lat: 26.2450, lng: -80.1440,
    hoursOfOp: 'Mon-Fri 6:00am - 4:00pm',
    materials: [
      { name: 'Asphalt', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Asphalt Millings', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Hot-mix asphalt plant with aggregate pickup.',
  },
  {
    name: 'Rinker Materials - Miami',
    phone: '(305) 633-0344',
    address: '2201 NW 36th St', city: 'Miami', state: 'FL', zip: '33142',
    lat: 25.8080, lng: -80.2390,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Concrete', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: '57 Stone', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Gravel', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Pea Gravel', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Ready-mix concrete & aggregate supplier.',
  },
  {
    name: 'Collier Paving & Concrete',
    phone: '(239) 597-7676',
    website: 'https://www.collierpaving.com',
    address: '3600 White Lake Blvd', city: 'Naples', state: 'FL', zip: '34117',
    lat: 26.1460, lng: -81.6180,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Concrete', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Base Rock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Limerock', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Sand', pricePerUnit: null, unit: 'TON', notes: '' },
      { name: 'Fill Dirt', pricePerUnit: null, unit: 'TON', notes: '' },
    ],
    notes: 'Concrete & base material. Good for Collier County jobs.',
  },
];

export async function seedDefaultQuarries() {
  const session = await requireSession();

  // Check if company already has quarries
  const count = await prisma.quarry.count({
    where: { companyId: session.companyId },
  });
  if (count > 0) return { success: true, seeded: 0 };

  // Seed all defaults
  await prisma.quarry.createMany({
    data: DEFAULT_QUARRIES.map((q) => ({
      companyId: session.companyId,
      name: q.name,
      phone: q.phone || null,
      email: null,
      contactPerson: null,
      website: (q as any).website || null,
      pricingUrl: null,
      address: q.address || null,
      city: q.city || null,
      state: q.state || null,
      zip: q.zip || null,
      lat: q.lat,
      lng: q.lng,
      hoursOfOp: q.hoursOfOp || null,
      materials: q.materials as any,
      notes: q.notes || null,
    })),
  });

  revalidatePath('/quarries');
  return { success: true, seeded: DEFAULT_QUARRIES.length };
}
