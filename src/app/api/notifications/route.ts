import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/notifications
 *   ?unreadOnly=true  — return only unread
 *   ?limit=20         — max rows (default 30)
 *   ?after=<isoDate>  — only notifications created after this timestamp (for polling)
 *
 * Also returns `unreadCount` in every response so the bell badge can update.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const limit = Math.min(Number(searchParams.get('limit') || '30'), 100);
  const after = searchParams.get('after'); // ISO timestamp

  const where: any = { companyId: session.companyId };
  if (unreadOnly) where.read = false;
  if (after) where.createdAt = { gt: new Date(after) };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { companyId: session.companyId, read: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

/**
 * PATCH /api/notifications
 * Body: { ids: string[] }   — mark those notifications as read
 * Body: { all: true }       — mark ALL unread as read
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  if (body.all) {
    await prisma.notification.updateMany({
      where: { companyId: session.companyId, read: false },
      data: { read: true },
    });
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await prisma.notification.updateMany({
      where: {
        id: { in: body.ids },
        companyId: session.companyId,
      },
      data: { read: true },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: { companyId: session.companyId, read: false },
  });

  return NextResponse.json({ ok: true, unreadCount });
}

/**
 * DELETE /api/notifications
 * Marks ALL notifications as read (preserved for audit — never deleted).
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { companyId: session.companyId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true, unreadCount: 0 });
}
