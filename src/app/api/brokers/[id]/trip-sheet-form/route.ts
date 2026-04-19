import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { uploadBlob, deleteBlob, isBlobUrl } from '@/lib/blob-storage';

// POST — upload a PDF template for this broker
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    // Only superadmin or tenant admin can upload templates
    if (session.role !== 'SUPERADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Tenant isolation: non-superadmins can only access their own brokers
    const broker = await prisma.broker.findUnique({ where: { id: params.id } });
    if (!broker) return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    if (session.role !== 'SUPERADMIN' && broker.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    const sizeError = validateFileSize(file, 'DOCUMENT');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Delete old blob if exists
    if (broker.tripSheetForm && isBlobUrl(broker.tripSheetForm)) {
      await deleteBlob(broker.tripSheetForm);
    }

    // Save with broker-id prefix to avoid conflicts
    const filename = `${broker.id}-trip-sheet-form.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await uploadBlob({
      pathname: `trip-sheet-forms/${filename}`,
      body: buffer,
      contentType: 'application/pdf',
    });

    // Update broker record with full blob URL
    await prisma.broker.update({
      where: { id: broker.id },
      data: { tripSheetForm: blob.url },
    });

    return NextResponse.json({ success: true, filename: blob.url });
  } catch (err: any) {
    console.error('Trip sheet form upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove the PDF template
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (session.role !== 'SUPERADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const broker = await prisma.broker.findUnique({ where: { id: params.id } });
    if (!broker) return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    if (session.role !== 'SUPERADMIN' && broker.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    if (broker.tripSheetForm && isBlobUrl(broker.tripSheetForm)) {
      await deleteBlob(broker.tripSheetForm);
    }

    await prisma.broker.update({
      where: { id: broker.id },
      data: { tripSheetForm: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Trip sheet form delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
