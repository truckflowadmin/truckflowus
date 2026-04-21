import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { uploadBlob, deleteBlob, isBlobUrl } from '@/lib/blob-storage';

/**
 * POST /api/company/logo
 * Upload a company logo (PNG/JPG, max 2MB). Stored via Vercel Blob.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG and JPG files are allowed' }, { status: 400 });
    }

    const sizeError = validateFileSize(file, 'IMAGE');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Delete old logo blob if exists
    const company = await prisma.company.findUnique({ where: { id: session.companyId } });
    if (company?.logoUrl && isBlobUrl(company.logoUrl)) {
      await deleteBlob(company.logoUrl);
    }

    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${session.companyId}-logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await uploadBlob({
      pathname: `company-logos/${filename}`,
      body: buffer,
      contentType: file.type,
    });

    await prisma.company.update({
      where: { id: session.companyId },
      data: { logoUrl: blob.url },
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err: any) {
    console.error('Company logo upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/company/logo
 * Remove the company logo.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findUnique({ where: { id: session.companyId } });
    if (company?.logoUrl && isBlobUrl(company.logoUrl)) {
      await deleteBlob(company.logoUrl);
    }

    await prisma.company.update({
      where: { id: session.companyId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Company logo delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
