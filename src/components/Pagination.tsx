import Link from 'next/link';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseUrl: string; // e.g. "/tickets" — will append ?page=N (preserves existing params if included)
  label?: string;  // e.g. "tickets"
}

export function Pagination({ page, totalPages, total, pageSize, baseUrl, label = 'items' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const sep = baseUrl.includes('?') ? '&' : '?';

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <div className="text-steel-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} {label}
      </div>
      <div className="flex gap-1">
        {page > 1 && (
          <Link
            href={`${baseUrl}${sep}page=${page - 1}`}
            className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50"
          >
            ← Prev
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={`${baseUrl}${sep}page=${page + 1}`}
            className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
