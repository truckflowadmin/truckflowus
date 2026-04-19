import Link from 'next/link';

export default function LockedFeaturePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tabName = searchParams.tab ?? 'This feature';

  return (
    <div className="p-8 max-w-lg mx-auto mt-16 text-center">
      <div className="panel p-10">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-steel-900 mb-2">{tabName}</h1>
        <p className="text-steel-600 mb-6">
          The <span className="font-semibold">{tabName}</span> tab is not included
          in your current plan. Upgrade your subscription to unlock this feature.
        </p>
        <div className="space-y-3">
          <Link
            href="/settings"
            className="btn-accent inline-block px-6"
          >
            View My Plan
          </Link>
          <p className="text-xs text-steel-500">
            Contact your administrator to discuss upgrading.
          </p>
        </div>
      </div>
    </div>
  );
}
