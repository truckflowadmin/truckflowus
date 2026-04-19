'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export async function updateBrokerPhoneAction(formData: FormData) {
  const session = await requireSession();
  const brokerId = String(formData.get('brokerId') || '');
  const phone = String(formData.get('phone') || '').trim() || null;

  const broker = await prisma.broker.findFirst({
    where: { id: brokerId, companyId: session.companyId },
  });
  if (!broker) throw new Error('Broker not found');

  await prisma.broker.update({
    where: { id: brokerId },
    data: { phone },
  });

  revalidatePath(`/brokers/${brokerId}`);
}
