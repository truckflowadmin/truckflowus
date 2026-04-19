import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { uploadBlob } from '@/lib/blob-storage';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const VALID_DOC_TYPES = ['REGISTRATION', 'INSURANCE', 'INSPECTION', 'TRUCK_PHOTO', 'OTHER'] as const;

/**
 * POST /api/fleet/trucks/photos — upload a truck document/photo
 * Body: FormData with `truckId`, `file`, `docType`, optional `label`
 * For required doc types (REGISTRATION, INSURANCE, INSPECTION), replaces existing.
 */
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const truckId = formData.get('truckId') as string;
    const file = formData.get('file') as File | null;
    const docType = (formData.get('docType') as string) || 'OTHER';
    const label = (formData.get('label') as string | null)?.trim() || null;

    if (!truckId) return NextResponse.json({ error: 'Missing truckId' }, { status: 400 });
    if (!VALID_DOC_TYPES.includes(docType as any)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const truck = await prisma.truck.findFirst({
      where: { id: truckId, companyId: session.companyId },
    });
    if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use JPG, PNG, WebP, GIF, or PDF.` },
        { status: 400 },
      );
    }

    const sizeError = validateFileSize(file, file.type === 'application/pdf' ? 'DOCUMENT' : 'IMAGE');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? '.png'
      : file.type === 'image/webp' ? '.webp'
      : file.type === 'application/pdf' ? '.pdf'
      : file.type === 'image/gif' ? '.gif'
      : '.jpg';
    const filename = `truck-${truckId}-${docType}-${randomUUID().slice(0, 8)}${ext}`;
    const bytes = await file.arrayBuffer();
    const blob = await uploadBlob({
      pathname: `fleet/${filename}`,
      body: Buffer.from(bytes),
      contentType: file.type,
    });

    const fileUrl = blob.url;

    // For required doc types, replace existing
    if (docType !== 'OTHER' && docType !== 'TRUCK_PHOTO') {
      const existing = await prisma.truckPhoto.findFirst({
        where: { truckId, docType: docType as any },
      });
      if (existing) {
        await prisma.truckPhoto.update({
          where: { id: existing.id },
          data: { fileUrl },
        });
        return NextResponse.json({
          ok: true,
          photo: { id: existing.id, docType, label: null, fileUrl },
          replaced: true,
        });
      }
    }

    const photo = await prisma.truckPhoto.create({
      data: { truckId, docType: docType as any, label, fileUrl },
    });

    return NextResponse.json({
      ok: true,
      photo: { id: photo.id, docType: photo.docType, label: photo.label, fileUrl: photo.fileUrl },
      replaced: false,
    });
  } catch (err: any) {
    console.error('Truck photo upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/fleet/trucks/photos?id=xxx — delete a truck photo/doc
 */
export async function DELETE(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Photo id required' }, { status: 400 });

  const photo = await prisma.truckPhoto.findUnique({
    where: { id },
    include: { truck: { select: { companyId: true } } },
  });
  if (!photo || photo.truck.companyId !== session.companyId) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  await prisma.truckPhoto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
