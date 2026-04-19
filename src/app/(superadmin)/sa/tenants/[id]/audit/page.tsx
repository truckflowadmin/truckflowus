import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import TenantNav from '@/components/TenantNav';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-900/60 text-emerald-200',
  update: 'bg-blue-900/60 text-blue-200',
  delete: 'bg-red-900/60 text-red-200',
  status_change: 'bg-yellow-900/60 text-yellow-200',
  assign: 'bg-purple-900/60 text-purple-200',
  suspend: 'bg-red-900/60 text-red-200',
  unsuspend: 'bg-emerald-900/60 text-emerald-200',
  plan_change: 'bg-blue-900/60 text-blue-200',
  feature_override: 'bg-purple-900/60 text-purple-200',
};

const ENTITY_ICONS: Record<string, string> = {
  ticket: '▤',
  driver: '▲',
  customer: '◉',
  company: '⚙',
};

export default async function TenantAuditPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <h1 className="text-xl font-bold text-white mb-4">
        Audit Log <span className="text-purple-400 font-normal">({logs.length})</span>
      </h1>

      {logs.length === 0 ? (
        <p className="text-center text-purple-400 py-12 text-sm">No audit entries yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            let details: Record<string, any> | null = null;
            try {
              details = log.details ? JSON.parse(log.details) : null;
            } catch {}

            return (
              <div
                key={log.id}
                className="panel-sa flex items-start gap-3 py-3 px-4"
              >
                <span className="text-lg mt-0.5">{ENTITY_ICONS[log.entityType] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${ACTION_COLORS[log.action] ?? 'bg-purple-900/40 text-purple-300'}`}>
                      {log.action.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-purple-400 uppercase">{log.entityType}</span>
                    <span className="text-xs text-purple-500">by {log.actor}</span>
                  </div>
                  <p className="text-sm text-purple-100 mt-1">{log.summary}</p>
                  {details && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-purple-500 cursor-pointer">
                        Show details
                      </summary>
                      <pre className="text-[10px] text-purple-400 bg-purple-950/50 rounded p-2 mt-1 overflow-x-auto">
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="text-xs text-purple-500 whitespace-nowrap">
                  {format(log.createdAt, 'MMM d, h:mm a')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
