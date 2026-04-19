import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads-private', 'broker-logos');

// POST — upload a logo image for this broker
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
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
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG and JPG files are allowed' }, { status: 400 });
    }

    const sizeError = validateFileSize(file, 'IMAGE');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Delete old file if exists
    if (broker.logoFile) {
      try { await unlink(path.join(UPLOAD_DIR, broker.logoFile)); } catch { /* ok */ }
    }

    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${broker.id}-logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    await prisma.broker.update({
      where: { id: broker.id },
      data: { logoFile: filename },
    });

    return NextResponse.json({ success: true, filename });
  } catch (err: any) {
    console.error('Broker logo upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove the logo
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

    if (broker.logoFile) {
      try { await unlink(path.join(UPLOAD_DIR, broker.logoFile)); } catch { /* ok */ }
    }

    await prisma.broker.update({
      where: { id: broker.id },
      data: { logoFile: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Broker logo delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
