import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateFileSize } from '@/lib/upload-limits';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads-private', 'documents');
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const VALID_DOC_TYPES = ['LICENSE_FRONT', 'LICENSE_BACK', 'MEDICAL_CERT', 'VOID_CHECK', 'OTHER'] as const;

/**
 * POST /api/driver/documents
 * Body: FormData with `token`, `file`, `docType`, optional `label`
 * Uploads a driver employment document.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get('token') as string;
    const file = formData.get('file') as File | null;
    const docType = formData.get('docType') as string;
    const label = (formData.get('label') as string | null)?.trim() || null;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
    if (!driver || !driver.active) {
      return NextResponse.json({ error: 'Invalid or inactive driver' }, { status: 401 });
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

    // Save file to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.type === 'image/png' ? '.png'
      : file.type === 'image/webp' ? '.webp'
      : file.type === 'application/pdf' ? '.pdf'
      : '.jpg';
    const filename = `${driver.id}-${docType}-${randomUUID().slice(0, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const fileUrl = `/api/uploads/documents/${filename}`;

    // For required doc types (not OTHER), replace the existing one if any
    if (docType !== 'OTHER') {
      const existing = await prisma.driverDocument.findFirst({
        where: { driverId: driver.id, docType: docType as any },
      });
      if (existing) {
        await prisma.driverDocument.update({
          where: { id: existing.id },
          data: { fileUrl, updatedAt: new Date() },
        });
        return NextResponse.json({
          success: true,
          document: { id: existing.id, docType, fileUrl, label },
          replaced: true,
        });
      }
    }

    // Create new document record
    const doc = await prisma.driverDocument.create({
      data: {
        driverId: driver.id,
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
    console.error('Document upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/driver/documents?token=xxx&id=yyy
 * Removes a driver document (only OTHER type can be deleted by driver).
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const docId = searchParams.get('id');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
    if (!driver || !driver.active) {
      return NextResponse.json({ error: 'Invalid or inactive driver' }, { status: 401 });
    }

    if (!docId) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    const doc = await prisma.driverDocument.findFirst({
      where: { id: docId, driverId: driver.id },
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
    console.error('Document delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
