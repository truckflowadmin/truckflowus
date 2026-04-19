'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

interface Props {
  tenantId: string;
  currentAction: string;
  currentFrom: string;
  currentTo: string;
  currentSearch: string;
  availableActions: string[];
  actionLabels: Record<string, string>;
}

export default function AuditFilters({
  tenantId,
  currentAction,
  currentFrom,
  currentTo,
  currentSearch,
  availableActions,
  actionLabels,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.push(pathname);
    });
  }, [router, pathname]);

  const hasFilters = !!(currentAction || currentFrom || currentTo || currentSearch);

  return (
    <div className="panel-sa p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-purple-300 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {isPending && (
            <span className="text-[10px] text-purple-500 animate-pulse">Loading...</span>
          )}
        </h3>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-purple-400 hover:text-purple-200 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Action type filter */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-purple-500 mb-1">
            Action Type
          </label>
          <select
            value={currentAction}
            onChange={(e) => updateFilter('action', e.target.value)}
            className="w-full bg-purple-950/60 border border-purple-800 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">All actions</option>
            {availableActions.map((action) => (
              <option key={action} value={action}>
                {actionLabels[action] || action.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-purple-500 mb-1">
            From Date
          </label>
          <input
            type="date"
            value={currentFrom}
            onChange={(e) => updateFilter('from', e.target.value)}
            className="w-full bg-purple-950/60 border border-purple-800 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 [color-scheme:dark]"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-purple-500 mb-1">
            To Date
          </label>
          <input
            type="date"
            value={currentTo}
            onChange={(e) => updateFilter('to', e.target.value)}
            className="w-full bg-purple-950/60 border border-purple-800 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 [color-scheme:dark]"
          />
        </div>

        {/* Search */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-purple-500 mb-1">
            Search
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.querySelector('input') as HTMLInputElement;
              updateFilter('search', input.value);
            }}
          >
            <div className="relative">
              <input
                type="text"
                defaultValue={currentSearch}
                placeholder="Name, email, phone..."
                className="w-full bg-purple-950/60 border border-purple-800 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 pr-8"
                onBlur={(e) => {
                  if (e.target.value !== currentSearch) {
                    updateFilter('search', e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    updateFilter('search', e.currentTarget.value);
                  }
                }}
              />
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>
        </div>
      </div>

      {/* Active filter tags */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 pt-1">
          {currentAction && (
            <span className="inline-flex items-center gap-1 bg-purple-900/60 text-purple-200 text-xs px-2 py-1 rounded-full">
              {actionLabels[currentAction] || currentAction}
              <button
                onClick={() => updateFilter('action', '')}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          )}
          {currentFrom && (
            <span className="inline-flex items-center gap-1 bg-purple-900/60 text-purple-200 text-xs px-2 py-1 rounded-full">
              From: {currentFrom}
              <button
                onClick={() => updateFilter('from', '')}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          )}
          {currentTo && (
            <span className="inline-flex items-center gap-1 bg-purple-900/60 text-purple-200 text-xs px-2 py-1 rounded-full">
              To: {currentTo}
              <button
                onClick={() => updateFilter('to', '')}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          )}
          {currentSearch && (
            <span className="inline-flex items-center gap-1 bg-purple-900/60 text-purple-200 text-xs px-2 py-1 rounded-full">
              Search: &quot;{currentSearch}&quot;
              <button
                onClick={() => updateFilter('search', '')}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
