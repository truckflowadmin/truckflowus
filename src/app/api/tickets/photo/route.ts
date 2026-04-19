import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { extractTicketData } from '@/lib/ai-extract';
import { validateFileSize } from '@/lib/upload-limits';
import { uploadBlob } from '@/lib/blob-storage';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/photo
 * Body: FormData with `file` (image) and `ticketId` (string)
 * Uploads/replaces a ticket's photo and re-runs AI extraction.
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
    const ticketId = formData.get('ticketId') as string;
    const file = formData.get('file') as File | null;

    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.` },
        { status: 400 },
      );
    }

    const sizeError = validateFileSize(file, 'IMAGE');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Verify ticket belongs to this company
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: session.companyId },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    if (ticket.invoiceId) {
      return NextResponse.json({ error: 'This ticket is on an invoice and cannot be modified' }, { status: 403 });
    }

    // Upload to Vercel Blob
    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${ticketId}-${randomUUID().slice(0, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await uploadBlob({
      pathname: `tickets/${filename}`,
      body: buffer,
      contentType: file.type,
    });
    const photoUrl = blob.url;

    // Run AI extraction
    const base64 = buffer.toString('base64');
    const extracted = await extractTicketData(base64, file.type);

    // Update ticket with new photo and extracted data
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        photoUrl,
        scannedTons: extracted.tons ?? null,
        scannedYards: extracted.yards ?? null,
        scannedTicketNumber: extracted.ticketNumber ?? null,
        scannedDate: extracted.date ?? null,
        scannedRawText: extracted.rawText ?? null,
        scannedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      photoUrl,
      extracted: {
        tons: extracted.tons ?? null,
        yards: extracted.yards ?? null,
        ticketNumber: extracted.ticketNumber ?? null,
        date: extracted.date ?? null,
      },
    });
  } catch (err: any) {
    console.error('Ticket photo replace error:', err);
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/tickets/photo
 * Body: JSON { ticketId, scannedTons?, scannedYards?, scannedTicketNumber?, scannedDate? }
 * Allows dispatcher to correct AI-extracted data on a ticket.
 */
export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ticketId, scannedTons, scannedYards, scannedTicketNumber, scannedDate } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });
    }
    if (scannedTons && scannedYards) {
      return NextResponse.json({ error: 'A ticket cannot have both tons and yards. Specify one or the other.' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: session.companyId },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    if (ticket.invoiceId) {
      return NextResponse.json({ error: 'This ticket is on an invoice and cannot be modified' }, { status: 403 });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        scannedTons: scannedTons ?? null,
        scannedYards: scannedYards ?? null,
        scannedTicketNumber: scannedTicketNumber ?? null,
        scannedDate: scannedDate ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      extracted: {
        tons: scannedTons ?? null,
        yards: scannedYards ?? null,
        ticketNumber: scannedTicketNumber ?? null,
        date: scannedDate ?? null,
      },
    });
  } catch (err: any) {
    console.error('Ticket scanned data correction error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
