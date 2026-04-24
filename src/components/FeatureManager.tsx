'use client';

import { useState, useMemo, useCallback } from 'react';

interface FeatureItem {
  key: string;
  label: string;
  description: string;
  side: string;
}

interface FeatureSection {
  title: string;
  hint: string;
  side: string;
  items: FeatureItem[];
}

interface Props {
  companyId: string;
  companyName: string;
  planName: string | null;
  planFeatures: string[];
  initialOverrides: string[];
  initialDisabled: string[];
  sections: FeatureSection[];
}

export function FeatureManager({
  companyId,
  companyName,
  planName,
  planFeatures,
  initialOverrides,
  initialDisabled,
  sections,
}: Props) {
  const planSet = useMemo(() => new Set(planFeatures), [planFeatures]);

  // Track each feature's effective state: checked = on, unchecked = off
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    const effective = new Set([...planFeatures, ...initialOverrides]);
    for (const d of initialDisabled) effective.delete(d);
    for (const section of sections) {
      for (const f of section.items) {
        states[f.key] = effective.has(f.key);
      }
    }
    return states;
  });

  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // Compute overrides and disabled from current states
  const computeOverridesAndDisabled = useCallback(() => {
    const overrides: string[] = [];
    const disabled: string[] = [];
    for (const [key, checked] of Object.entries(featureStates)) {
      const inPlan = planSet.has(key);
      if (checked && !inPlan) overrides.push(key);
      else if (!checked && inPlan) disabled.push(key);
    }
    return { overrides, disabled };
  }, [featureStates, planSet]);

  const toggleFeature = (key: string) => {
    setFeatureStates(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
    setSaveMsg(null);
  };

  const toggleSection = (side: string) => {
    setCollapsedSections(prev => ({ ...prev, [side]: !prev[side] }));
  };

  // Batch actions
  const enableAll = (sectionItems: FeatureItem[]) => {
    setFeatureStates(prev => {
      const next = { ...prev };
      for (const f of sectionItems) next[f.key] = true;
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const disableAll = (sectionItems: FeatureItem[]) => {
    setFeatureStates(prev => {
      const next = { ...prev };
      for (const f of sectionItems) next[f.key] = false;
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const resetToPlan = () => {
    setFeatureStates(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = planSet.has(key);
      }
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const { overrides, disabled } = computeOverridesAndDisabled();
      const res = await fetch('/api/sa/tenants/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, overrides, disabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to save');
      }
      const data = await res.json();
      setSaveMsg({ type: 'ok', text: `Saved — ${data.overrides} override(s), ${data.disabled} disabled` });
      setDirty(false);
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // Filter features by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map(s => ({
        ...s,
        items: s.items.filter(
          f =>
            f.label.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q),
        ),
      }))
      .filter(s => s.items.length > 0);
  }, [sections, search]);

  // Stats
  const { overrides: currentOverrides, disabled: currentDisabled } = computeOverridesAndDisabled();
  const totalFeatures = sections.reduce((s, sec) => s + sec.items.length, 0);
  const enabledCount = Object.values(featureStates).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white text-lg">Feature Management</h2>
          <p className="text-xs text-purple-300 mt-0.5">
            Manage feature access for <strong className="text-white">{companyName}</strong>
            {planName && <> — Plan: <strong className="text-purple-200">{planName}</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToPlan}
            className="text-xs px-3 py-1.5 rounded border border-purple-700 text-purple-300 hover:bg-purple-900/50 transition-colors"
            title="Reset all features to match the plan defaults"
          >
            Reset to Plan
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className={`text-sm px-4 py-1.5 rounded font-medium transition-colors ${
              dirty
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-purple-900/50 text-purple-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Save message */}
      {saveMsg && (
        <div
          className={`text-sm px-3 py-2 rounded ${
            saveMsg.type === 'ok'
              ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800'
              : 'bg-red-900/50 text-red-300 border border-red-800'
          }`}
        >
          {saveMsg.text}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-purple-400">
          {enabledCount}/{totalFeatures} enabled
        </span>
        {currentOverrides.length > 0 && (
          <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
            {currentOverrides.length} override{currentOverrides.length !== 1 ? 's' : ''}
          </span>
        )}
        {currentDisabled.length > 0 && (
          <span className="bg-red-900/50 text-red-300 px-2 py-0.5 rounded">
            {currentDisabled.length} disabled from plan
          </span>
        )}
        {dirty && (
          <span className="bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-purple-950/50 border border-purple-800 rounded px-3 py-2 text-sm text-white placeholder-purple-500 focus:outline-none focus:border-purple-600"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-300 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Feature sections */}
      {filteredSections.map(section => {
        const isCollapsed = collapsedSections[section.side] && !search;
        const sectionEnabled = section.items.filter(f => featureStates[f.key]).length;
        const sectionOverrides = section.items.filter(f => featureStates[f.key] && !planSet.has(f.key)).length;
        const sectionDisabled = section.items.filter(f => !featureStates[f.key] && planSet.has(f.key)).length;

        return (
          <div key={section.side} className="border border-purple-800/60 rounded-lg overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.side)}
              className="w-full flex items-center justify-between px-4 py-3 bg-purple-900/30 hover:bg-purple-900/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-purple-400 text-sm">{isCollapsed ? '▸' : '▾'}</span>
                <div>
                  <div className="text-white text-sm font-medium">{section.title}</div>
                  <div className="text-purple-400 text-xs">{section.hint}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-purple-400">{sectionEnabled}/{section.items.length}</span>
                {sectionOverrides > 0 && (
                  <span className="bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">{sectionOverrides} added</span>
                )}
                {sectionDisabled > 0 && (
                  <span className="bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">{sectionDisabled} removed</span>
                )}
              </div>
            </button>

            {/* Section body */}
            {!isCollapsed && (
              <div className="p-4 space-y-1">
                {/* Batch actions */}
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-purple-800/40">
                  <span className="text-xs text-purple-400 mr-1">Batch:</span>
                  <button
                    onClick={() => enableAll(section.items)}
                    className="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={() => disableAll(section.items)}
                    className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors"
                  >
                    Disable All
                  </button>
                </div>

                {/* Feature rows */}
                {section.items.map(f => {
                  const checked = featureStates[f.key];
                  const inPlan = planSet.has(f.key);
                  const isOverride = checked && !inPlan;
                  const isDisabledFromPlan = !checked && inPlan;

                  return (
                    <div
                      key={f.key}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer group ${
                        checked
                          ? 'bg-purple-900/20 hover:bg-purple-900/40'
                          : 'hover:bg-purple-900/20 opacity-60'
                      }`}
                      onClick={() => toggleFeature(f.key)}
                    >
                      {/* Toggle switch */}
                      <div
                        className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors ${
                          checked ? 'bg-purple-600' : 'bg-purple-900'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            checked ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${checked ? 'text-white' : 'text-purple-400'}`}>
                            {f.label}
                          </span>
                          {/* Status badges */}
                          {inPlan && checked && !isOverride && (
                            <span className="text-[10px] bg-purple-800/60 text-purple-300 rounded px-1.5 py-0.5">
                              PLAN
                            </span>
                          )}
                          {isOverride && (
                            <span className="text-[10px] bg-blue-800 text-blue-200 rounded px-1.5 py-0.5 font-medium">
                              OVERRIDE +
                            </span>
                          )}
                          {isDisabledFromPlan && (
                            <span className="text-[10px] bg-red-800 text-red-200 rounded px-1.5 py-0.5 font-medium">
                              DISABLED ×
                            </span>
                          )}
                          {!inPlan && !checked && (
                            <span className="text-[10px] text-purple-600 rounded px-1.5 py-0.5">
                              NOT IN PLAN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-purple-400 mt-0.5 truncate">{f.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {filteredSections.length === 0 && search && (
        <div className="text-center py-8 text-purple-400 text-sm">
          No features match &quot;{search}&quot;
        </div>
      )}

      {/* Bottom save bar (sticky when dirty) */}
      {dirty && (
        <div className="sticky bottom-0 bg-purple-950/95 backdrop-blur border-t border-purple-800 rounded-lg p-3 flex items-center justify-between -mx-1">
          <div className="text-sm text-yellow-300">
            You have unsaved changes
            {currentOverrides.length > 0 && ` — ${currentOverrides.length} override(s)`}
            {currentDisabled.length > 0 && ` — ${currentDisabled.length} disabled`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetToPlan}
              className="text-xs px-3 py-1.5 rounded border border-purple-700 text-purple-300 hover:bg-purple-900/50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm px-4 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-500 font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
