import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import DriverDocuments from './DriverDocuments';

async function updateDriverAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const driver = await prisma.driver.findFirst({ where: { id, companyId: session.companyId } });
  if (!driver) throw new Error('Not found');

  const name = String(formData.get('name') || '').trim();
  const phoneRaw = String(formData.get('phone') || '').trim();
  if (!name || !phoneRaw) throw new Error('Name and phone required');

  const digits = phoneRaw.replace(/\D/g, '');
  let phone = phoneRaw;
  if (digits.length === 10) phone = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) phone = `+${digits}`;
  else if (!phoneRaw.startsWith('+')) phone = `+${digits}`;

  const email = String(formData.get('email') || '').trim() || null;
  const address = String(formData.get('address') || '').trim() || null;
  const city = String(formData.get('city') || '').trim() || null;
  const state = String(formData.get('state') || '').trim() || null;
  const zip = String(formData.get('zip') || '').trim() || null;
  const emergencyContactName = String(formData.get('emergencyContactName') || '').trim() || null;
  const emergencyContactPhone = String(formData.get('emergencyContactPhone') || '').trim() || null;

  const assignedTruckId = String(formData.get('assignedTruckId') || '').trim() || null;

  // Sync truckNumber from the assigned truck record
  let truckNumber: string | null = null;
  if (assignedTruckId) {
    const truck = await prisma.truck.findFirst({
      where: { id: assignedTruckId, companyId: session.companyId },
      select: { truckNumber: true },
    });
    if (!truck) throw new Error('Assigned truck not found');
    truckNumber = truck.truckNumber;
  }

  const workerType = String(formData.get('workerType') || 'EMPLOYEE') as 'EMPLOYEE' | 'CONTRACTOR';
  const payType = String(formData.get('payType') || 'HOURLY') as 'HOURLY' | 'SALARY' | 'PERCENTAGE';
  const payRateStr = String(formData.get('payRate') || '').trim();
  const payRate = payRateStr ? parseFloat(payRateStr) : null;

  const payDay = String(formData.get('payDay') || '').trim() || null;
  const payFrequency = String(formData.get('payFrequency') || '').trim() || null;

  // SMS notification preferences
  const smsEnabled = formData.get('smsEnabled') === 'on';
  const smsJobAssignment = formData.get('smsJobAssignment') === 'on';
  const smsJobStatusChange = formData.get('smsJobStatusChange') === 'on';
  const smsNewJobAvailable = formData.get('smsNewJobAvailable') === 'on';
  const smsPayrollReady = formData.get('smsPayrollReady') === 'on';

  await prisma.driver.update({
    where: { id },
    data: {
      name, phone, email,
      address, city, state, zip,
      emergencyContactName, emergencyContactPhone,
      assignedTruckId,
      truckNumber,
      workerType, payType, payRate, payDay, payFrequency,
      smsEnabled, smsJobAssignment, smsJobStatusChange, smsNewJobAvailable, smsPayrollReady,
    } as any,
  });

  revalidatePath('/drivers');
  revalidatePath(`/drivers/${id}/edit`);
  redirect('/drivers');
}

export default async function EditDriverPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const [driver, documents, trucks] = await Promise.all([
    prisma.driver.findFirst({
      where: { id: params.id, companyId: session.companyId },
    }),
    prisma.driverDocument.findMany({
      where: {
        driverId: params.id,
        driver: { companyId: session.companyId },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.truck.findMany({
      where: { companyId: session.companyId, status: 'ACTIVE' },
      orderBy: { truckNumber: 'asc' },
      select: { id: true, truckNumber: true, make: true, model: true },
    }),
  ]);
  if (!driver) notFound();

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/drivers" className="text-sm text-steel-500 hover:text-steel-800">← Drivers</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Edit Driver</h1>
      </header>

      <form action={updateDriverAction} className="panel p-6 space-y-4">
        <input type="hidden" name="id" value={driver.id} />
        <div>
          <label className="label">Name *</label>
          <input name="name" required className="input" defaultValue={driver.name} />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input name="phone" required className="input" defaultValue={driver.phone} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Assigned Truck</label>
            <select name="assignedTruckId" className="input" defaultValue={driver.assignedTruckId ?? ''}>
              <option value="">None</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truckNumber}{t.make ? ` — ${t.make}${t.model ? ' ' + t.model : ''}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-steel-400 mt-1">Required for driver expense submissions</p>
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" defaultValue={driver.email ?? ''} />
          </div>
        </div>

        <div className="pt-3 border-t border-steel-200">
          <h3 className="text-sm font-semibold text-steel-700 mb-3">Address</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Street Address</label>
              <input name="address" className="input" defaultValue={driver.address ?? ''} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">City</label>
                <input name="city" className="input" defaultValue={driver.city ?? ''} />
              </div>
              <div>
                <label className="label">State</label>
                <input name="state" className="input" maxLength={2} defaultValue={driver.state ?? ''} />
              </div>
              <div>
                <label className="label">ZIP</label>
                <input name="zip" className="input" maxLength={10} defaultValue={driver.zip ?? ''} />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-steel-200">
          <h3 className="text-sm font-semibold text-steel-700 mb-3">Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Contact Name</label>
              <input name="emergencyContactName" className="input" defaultValue={driver.emergencyContactName ?? ''} />
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <input name="emergencyContactPhone" type="tel" className="input" defaultValue={driver.emergencyContactPhone ?? ''} />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-steel-200">
          <h3 className="text-sm font-semibold text-steel-700 mb-3">Payroll</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Worker Type *</label>
              <select name="workerType" required className="input" defaultValue={driver.workerType}>
                <option value="EMPLOYEE">Employee</option>
                <option value="CONTRACTOR">Contractor</option>
              </select>
            </div>
            <div>
              <label className="label">Pay Type</label>
              <select name="payType" className="input" defaultValue={driver.payType}>
                <option value="HOURLY">Hourly</option>
                <option value="SALARY">Salary</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
            </div>
            <div>
              <label className="label">Pay Rate</label>
              <input name="payRate" type="number" step="0.01" min="0" className="input" defaultValue={driver.payRate?.toString() ?? ''} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Pay Day</label>
              <select name="payDay" className="input" defaultValue={(driver as any).payDay ?? ''}>
                <option value="">— Not set —</option>
                <option value="MONDAY">Monday</option>
                <option value="TUESDAY">Tuesday</option>
                <option value="WEDNESDAY">Wednesday</option>
                <option value="THURSDAY">Thursday</option>
                <option value="FRIDAY">Friday</option>
                <option value="SATURDAY">Saturday</option>
                <option value="SUNDAY">Sunday</option>
              </select>
            </div>
            <div>
              <label className="label">Pay Frequency</label>
              <select name="payFrequency" className="input" defaultValue={(driver as any).payFrequency ?? ''}>
                <option value="">— Not set —</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Biweekly</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-steel-200">
          <h3 className="text-sm font-semibold text-steel-700 mb-3">SMS Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="smsEnabled" className="rounded border-steel-300"
                defaultChecked={(driver as any).smsEnabled ?? true} />
              <span className="text-sm font-medium text-steel-800">Enable SMS notifications</span>
            </label>
            <div className="ml-6 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="smsJobAssignment" className="rounded border-steel-300"
                  defaultChecked={(driver as any).smsJobAssignment ?? true} />
                <span className="text-sm text-steel-600">Job assignment — notified when assigned to a job</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="smsJobStatusChange" className="rounded border-steel-300"
                  defaultChecked={(driver as any).smsJobStatusChange ?? true} />
                <span className="text-sm text-steel-600">Job status changes — notified when job is updated or cancelled</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="smsNewJobAvailable" className="rounded border-steel-300"
                  defaultChecked={(driver as any).smsNewJobAvailable ?? false} />
                <span className="text-sm text-steel-600">New jobs available — notified when a matching job is created</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="smsPayrollReady" className="rounded border-steel-300"
                  defaultChecked={(driver as any).smsPayrollReady ?? true} />
                <span className="text-sm text-steel-600">Payroll ready — notified when payroll is calculated</span>
              </label>
            </div>
            <p className="text-xs text-steel-400 ml-6">Individual preferences only apply when the master toggle is enabled.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-steel-200">
          <button type="submit" className="btn-accent">Save</button>
          <Link href="/drivers" className="btn-ghost">Cancel</Link>
        </div>
      </form>

      <DriverDocuments
        driverId={driver.id}
        documents={documents.map((d) => ({
          id: d.id,
          docType: d.docType,
          label: d.label,
          fileUrl: d.fileUrl,
          updatedAt: d.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
