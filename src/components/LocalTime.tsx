'use client';

/**
 * Renders a Date (or ISO string) in the user's local timezone.
 * Server Components can't detect the client's timezone, so we
 * delegate the formatting to this tiny client component.
 */
export default function LocalTime({
  date,
  fallback = 'Never',
}: {
  date: string | Date | null | undefined;
  fallback?: string;
}) {
  if (!date) return <>{fallback}</>;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return <>{fallback}</>;

  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning>
      {d.toLocaleString()}
    </time>
  );
}
