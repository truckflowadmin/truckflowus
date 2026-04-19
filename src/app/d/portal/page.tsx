import { redirect } from 'next/navigation';
import { getDriverSession } from '@/lib/driver-auth';
import { DriverPortalContent } from '../[token]/page';

export default async function DriverPortalPage() {
  const session = await getDriverSession();
  if (!session) {
    redirect('/d/login');
  }

  return <DriverPortalContent driverId={session.driverId} />;
}
