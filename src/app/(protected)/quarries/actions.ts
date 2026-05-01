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

export async function createQuarry(data: {
  name: string;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  website?: string | null;
  pricingUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  hoursOfOp?: string | null;
  materials?: MaterialEntry[];
  notes?: string | null;
}) {
  const session = await requireSession();

  if (!data.name?.trim()) return { success: false, error: 'Name is required' };

  // Prevent duplicates — check by name within the same company
  const existing = await prisma.quarry.findFirst({
    where: {
      companyId: session.companyId,
      name: { equals: data.name.trim(), mode: 'insensitive' as any },
    },
  });
  if (existing) return { success: false, error: 'A quarry with this name already exists in your directory' };

  const quarry = await prisma.quarry.create({
    data: {
      companyId: session.companyId,
      name: data.name.trim(),
      phone: data.phone || null,
      email: data.email || null,
      contactPerson: data.contactPerson || null,
      website: data.website || null,
      pricingUrl: data.pricingUrl || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      hoursOfOp: data.hoursOfOp || null,
      materials: (data.materials || []) as any,
      notes: data.notes || null,
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
