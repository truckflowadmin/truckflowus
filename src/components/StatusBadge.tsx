const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-steel-200 text-steel-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-safety text-diesel',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-steel-100 text-steel-500',
  ISSUE: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? ''}`}>{status.replace('_', ' ')}</span>;
}
