import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateInvoicePdf, generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  let session;
  try { session = await requireSession(); }
  catch { return NextResponse.redirect(new URL('/login', process.env.APP_URL || 'http://localhost:3000')); }

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: {
      customer: true,
      broker: true,
      tickets: {
        where: { deletedAt: null },
        orderBy: { completedAt: 'asc' },
        include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
      },
      company: true,
    },
  });
  if (!invoice) return new NextResponse('Not found', { status: 404 });

  const truckOverrides = await getTruckOverrides(session.companyId, invoice.tickets.map((t) => t.truckNumber ?? ''));

  let pdfBuffer: Buffer;

  if (invoice.invoiceType === 'BROKER' && invoice.broker) {
    // Use the broker trip-sheet style PDF
    const brokerContacts = Array.isArray(invoice.broker.contacts)
      ? invoice.broker.contacts as any[]
      : JSON.parse(String(invoice.broker.contacts || '[]'));

    pdfBuffer = await generateBrokerInvoicePdf({
      company: invoice.company,
      broker: {
        name: invoice.broker.name,
        contacts: brokerContacts,
        email: invoice.broker.email,
        mailingAddress: invoice.broker.mailingAddress,
        commissionPct: Number(invoice.broker.commissionPct),
        tripSheetForm: invoice.broker.tripSheetForm,
        logoFile: invoice.broker.logoFile,
      },
      periodEnd: invoice.periodEnd,
      tickets: invoice.tickets.map((t) => ({
        ticketNumber: t.ticketNumber,
        ticketRef: t.ticketRef,
        date: t.date,
        completedAt: t.completedAt,
        customer: t.customer?.name ?? null,
        driver: t.driver?.name ?? null,
        truckNumber: t.truckNumber,
        material: t.material,
        quantityType: t.quantityType,
        quantity: Number(t.quantity),
        hauledFrom: t.hauledFrom,
        hauledTo: t.hauledTo,
        ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit) : 0,
        status: t.status,
        payToName: truckOverrides.get(t.truckNumber ?? '')?.payToName ?? null,
        dispatcherName: truckOverrides.get(t.truckNumber ?? '')?.dispatcherName ?? null,
      })),
    });
  } else {
    // Standard customer invoice PDF
    pdfBuffer = await generateInvoicePdf(invoice as any);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="INV-${String(invoice.invoiceNumber).padStart(4, '0')}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  });
}
