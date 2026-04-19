import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSession, hashAnswer, SECURITY_QUESTIONS } from '@/lib/driver-auth';
import { audit } from '@/lib/audit';

/**
 * POST /api/driver/security-questions
 * Saves new security questions for the current driver session.
 * Used when mustSetSecurityQuestions is true (after superadmin cleared them).
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const { securityQ1, securityA1, securityQ2, securityA2, securityQ3, securityA3 } = body;

  if (!securityQ1 || !securityA1 || !securityQ2 || !securityA2 || !securityQ3 || !securityA3) {
    return NextResponse.json({ error: 'All 3 security questions and answers are required' }, { status: 400 });
  }

  // Validate that questions are from the allowed list
  const validQs = new Set(SECURITY_QUESTIONS);
  if (!validQs.has(securityQ1) || !validQs.has(securityQ2) || !validQs.has(securityQ3)) {
    return NextResponse.json({ error: 'Invalid security question' }, { status: 400 });
  }

  // Must be 3 different questions
  if (new Set([securityQ1, securityQ2, securityQ3]).size < 3) {
    return NextResponse.json({ error: 'Please pick 3 different questions' }, { status: 400 });
  }

  const [a1Hash, a2Hash, a3Hash] = await Promise.all([
    hashAnswer(securityA1),
    hashAnswer(securityA2),
    hashAnswer(securityA3),
  ]);

  await prisma.driver.update({
    where: { id: session.driverId },
    data: {
      securityQ1,
      securityA1: a1Hash,
      securityQ2,
      securityA2: a2Hash,
      securityQ3,
      securityA3: a3Hash,
    },
  });

  // Clear the mustSetSecurityQuestions flag via raw SQL (safe if column doesn't exist yet)
  try {
    await prisma.$executeRaw`
      UPDATE "Driver" SET "mustSetSecurityQuestions" = false WHERE "id" = ${session.driverId}
    `;
  } catch {
    // Column may not exist — that's fine, flag wasn't set anyway
  }

  await audit({
    companyId: session.companyId,
    entityType: 'driver',
    entityId: session.driverId,
    action: 'update',
    actor: session.name,
    actorRole: 'DISPATCHER',
    summary: `Driver ${session.name} re-set security questions after admin clear`,
  });

  return NextResponse.json({ ok: true });
}
