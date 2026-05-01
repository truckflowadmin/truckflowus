'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

interface MaterialEntry {
  name: string;
  pricePerUnit: number | null;
  unit: string; // TON, YARD, LOAD
  notes: string;
}

export async function createQuarry(formData: FormData) {
  const session = await requireSession();

  const name = String(formData.get('name') || '').trim();
  if (!name) return { success: false, error: 'Name is required' };

  const materialsJson = String(formData.get('materials') || '[]');
  let materials: MaterialEntry[] = [];
  try { materials = JSON.parse(materialsJson); } catch { /* empty */ }

  const quarry = await prisma.quarry.create({
    data: {
      companyId: session.companyId,
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
  return { success: true, id: quarry.id };
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

export async function deleteQuarry(id: string) {
  const session = await requireSession();
  const existing = await prisma.quarry.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!existing) return { success: false, error: 'Not found' };

  await prisma.quarry.delete({ where: { id } });
  revalidatePath('/quarries');
  return { success: true };
}
