import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { uploadBlob } from '@/lib/blob-storage';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const VALID_DOC_TYPES = ['LICENSE_FRONT', 'LICENSE_BACK', 'MEDICAL_CERT', 'VOID_CHECK', 'OTHER'] as const;

/**
 * POST /api/drivers/documents
 * Dispatcher uploads a document on behalf of a driver.
 * Body: FormData with `driverId`, `file`, `docType`, optional `label`
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const driverId = formData.get('driverId') as string;
    const file = formData.get('file') as File | null;
    const docType = formData.get('docType') as string;
    const label = (formData.get('label') as string | null)?.trim() || null;

    if (!driverId) {
      return NextResponse.json({ error: 'Missing driverId' }, { status: 400 });
    }

    // Verify driver belongs to dispatcher's company
    const driver = await prisma.driver.findFirst({
      where: { id: driverId, companyId: session.companyId },
    });
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use JPG, PNG, WebP, or PDF.` },
        { status: 400 },
      );
    }

    if (!docType || !VALID_DOC_TYPES.includes(docType as any)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const sizeError = validateFileSize(file, file.type === 'application/pdf' ? 'DOCUMENT' : 'IMAGE');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Upload to Vercel Blob
    const ext = file.type === 'image/png' ? '.png'
      : file.type === 'image/webp' ? '.webp'
      : file.type === 'application/pdf' ? '.pdf'
      : '.jpg';
    const filename = `${driverId}-${docType}-${randomUUID().slice(0, 8)}${ext}`;
    const bytes = await file.arrayBuffer();
    const blob = await uploadBlob({
      pathname: `documents/${filename}`,
      body: Buffer.from(bytes),
      contentType: file.type,
    });

    const fileUrl = blob.url;

    // For required doc types (not OTHER), replace the existing one
    if (docType !== 'OTHER') {
      const existing = await prisma.driverDocument.findFirst({
        where: { driverId, docType: docType as any },
      });
      if (existing) {
        await prisma.driverDocument.update({
          where: { id: existing.id },
          data: { fileUrl, updatedAt: new Date() },
        });
        return NextResponse.json({
          success: true,
          document: { id: existing.id, docType, fileUrl, label: null },
          replaced: true,
        });
      }
    }

    const doc = await prisma.driverDocument.create({
      data: {
        driverId,
        docType: docType as any,
        label: docType === 'OTHER' ? label : null,
        fileUrl,
      },
    });

    return NextResponse.json({
      success: true,
      document: { id: doc.id, docType: doc.docType, fileUrl: doc.fileUrl, label: doc.label },
      replaced: false,
    });
  } catch (err: any) {
    console.error('Dispatcher document upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/drivers/documents?id=xxx
 * Dispatcher deletes an OTHER document.
 */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');
    if (!docId) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    const doc = await prisma.driverDocument.findFirst({
      where: { id: docId, driver: { companyId: session.companyId } },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.docType !== 'OTHER') {
      return NextResponse.json({ error: 'Required documents cannot be deleted, only replaced' }, { status: 400 });
    }

    await prisma.driverDocument.delete({ where: { id: docId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Dispatcher document delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
