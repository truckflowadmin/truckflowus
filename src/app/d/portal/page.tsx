import { redirect } from 'next/navigation';
import { getDriverSession } from '@/lib/driver-auth';
import { prisma } from '@/lib/prisma';
import { DriverPortalContent } from '../[token]/page';
import DriverSecurityQuestionsSetup from './SecurityQuestionsSetup';

export default async function DriverPortalPage() {
  const session = await getDriverSession();
  if (!session) {
    redirect('/d/login');
  }

  // Check if driver needs to set up security questions (cleared by superadmin)
  let mustSetSQ = false;
  try {
    const rows = await prisma.$queryRaw<{ mustSetSecurityQuestions: boolean }[]>`
      SELECT "mustSetSecurityQuestions" FROM "Driver" WHERE "id" = ${session.driverId} LIMIT 1
    `;
    mustSetSQ = rows[0]?.mustSetSecurityQuestions ?? false;
  } catch {
    // Column may not exist yet — skip check
  }

  if (mustSetSQ) {
    return <DriverSecurityQuestionsSetup driverName={session.name} />;
  }

  return <DriverPortalContent driverId={session.driverId} />;
}
