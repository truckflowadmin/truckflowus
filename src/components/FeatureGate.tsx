/**
 * Soft-gate component for dispatcher UI.
 *
 * When a feature is enabled, renders children normally.
 * When locked, renders the children in a disabled/dimmed state with an
 * upgrade badge overlay. This way dispatchers can SEE features exist
 * (driving upsell) but can't use them.
 *
 * Usage:
 *   <FeatureGate enabled={has('reports')} featureLabel="Reports & Analytics" planName="Pro">
 *     <ReportsPage />
 *   </FeatureGate>
 */

interface FeatureGateProps {
  enabled: boolean;
  featureLabel: string;
  planName?: string; // e.g. "Pro" — which plan unlocks this
  children: React.ReactNode;
  /** If true, renders nothing when locked instead of the soft gate. */
  hardGate?: boolean;
}

export function FeatureGate({
  enabled,
  featureLabel,
  planName,
  children,
  hardGate = false,
}: FeatureGateProps) {
  if (enabled) return <>{children}</>;
  if (hardGate) return null;

  return (
    <div className="relative">
      {/* Dimmed overlay */}
      <div className="opacity-30 pointer-events-none select-none blur-[1px]" aria-hidden>
        {children}
      </div>
      {/* Lock card */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white border-2 border-steel-300 rounded-xl shadow-lg p-6 text-center max-w-sm mx-4">
          <div className="text-3xl mb-2">🔒</div>
          <h3 className="font-bold text-lg text-steel-900 mb-1">{featureLabel}</h3>
          <p className="text-sm text-steel-600 mb-3">
            This feature is not included in your current plan.
            {planName && (
              <> Available on <span className="font-semibold text-safety-dark">{planName}</span> and above.</>
            )}
          </p>
          <p className="text-xs text-steel-500">
            Contact your administrator to upgrade.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline lock badge for buttons/links.
 * Shows a small lock icon + "Upgrade" text next to a disabled control.
 */
export function FeatureLockBadge({ planName }: { planName?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-steel-500 bg-steel-100 border border-steel-200 rounded-full px-2 py-0.5">
      🔒 {planName ? `${planName}+` : 'Upgrade'}
    </span>
  );
}
