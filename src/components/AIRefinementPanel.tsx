import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ScanSearch, Sparkles, TriangleAlert } from 'lucide-react';
import { AnalysisResult, Process, SystemItem } from '../types';
import { CLASSIFICATION_META } from '../lib/utils';
import { ClassChip, Meter } from './ui';

type Classification = 'agentic-ai' | 'automation' | 'human-in-the-loop';

const DRIVER_LABELS: Array<{ key: 'volume' | 'repetitiveness' | 'ruleClarity' | 'errorSensitivity'; label: string }> = [
  { key: 'volume', label: 'Volume' },
  { key: 'repetitiveness', label: 'Repetitiveness' },
  { key: 'ruleClarity', label: 'Rule clarity' },
  { key: 'errorSensitivity', label: 'Error sensitivity' },
];

/** AI refinement & classification (US-09/10) — explainable, overridable, feeds the hackathon list. */
export default function AIRefinementPanel({
  processes,
  availableSystems,
  focusProcessId,
  clearFocusProcess,
  onUpdateProcess,
}: {
  processes: Process[];
  availableSystems: SystemItem[];
  focusProcessId: string | null;
  clearFocusProcess: () => void;
  onUpdateProcess: (process: Process) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(focusProcessId ?? processes[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Classification>>({});
  const [applied, setApplied] = useState(false);
  const autoRanFor = useRef<string | null>(null);

  const selected = processes.find((p) => p.id === selectedId) ?? null;

  const runAnalysis = async (proc: Process) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setOverrides({});
    setApplied(false);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proc.title,
          description: proc.description,
          steps: proc.steps,
          availableSystems: availableSystems.map(s => ({
            name: s.name,
            category: s.category,
            description: s.description || ''
          }))
        }),
      });
      if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
      setResult((await res.json()) as AnalysisResult);
    } catch (err: any) {
      console.error(err);
      setError('The refinement engine could not be reached — check the dev server and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Arriving from the capture journey with a specific process → run automatically.
  useEffect(() => {
    if (focusProcessId && autoRanFor.current !== focusProcessId) {
      const proc = processes.find((p) => p.id === focusProcessId);
      if (proc) {
        autoRanFor.current = focusProcessId;
        setSelectedId(focusProcessId);
        runAnalysis(proc);
        clearFocusProcess();
      }
    }
  }, [focusProcessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyResults = () => {
    if (!selected || !result) return;
    const byOrder = new Map<number, AnalysisResult['refinedSteps'][number]>(
      result.refinedSteps.map((rs) => [rs.order, rs]),
    );
    const userOverrides: Record<string, Classification> = { ...(selected.userOverrides ?? {}) };

    const steps = selected.steps.map((step) => {
      const refined = byOrder.get(step.order);
      if (!refined) return step;
      const override = overrides[step.order];
      if (override && override !== refined.aiClassification) userOverrides[step.id] = override;
      else delete userOverrides[step.id];
      return {
        ...step,
        name: refined.name || step.name,
        description: refined.refinedDescription || step.description,
        inputs: step.inputs.length ? step.inputs : refined.suggestedInputs ?? [],
        outputs: step.outputs.length ? step.outputs : refined.suggestedOutputs ?? [],
        aiClassification: refined.aiClassification,
        aiRationale: refined.aiRationale,
      };
    });

    onUpdateProcess({
      ...selected,
      title: result.refinedTitle || selected.title,
      description: result.refinedDescription || selected.description,
      steps,
      status: 'Refined',
      gaps: result.gaps,
      automationSuitability: result.automationSuitability,
      volumeRating: result.drivers.volume,
      repetitivenessRating: result.drivers.repetitiveness,
      effortRating: result.drivers.repetitiveness,
      errorSensitivityRating: result.drivers.errorSensitivity,
      userOverrides,
      lastUpdated: new Date().toISOString(),
    });
    setApplied(true);
  };

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">AI refinement &amp; classification</h2>
        <p className="text-sm text-mute mt-0.5 max-w-xl">
          The agent rewrites each step to be machine-readable, labels it agentic-AI / automation /
          human-in-the-loop with its reasoning, and scores the whole process. You stay in control — override anything.
        </p>
      </div>

      {/* Picker */}
      <div className="card p-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56">
          <label className="label" htmlFor="ref-proc">Process to analyse</label>
          <select
            id="ref-proc"
            className="field cursor-pointer"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setResult(null);
              setError(null);
              setApplied(false);
            }}
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.ownerName} ({p.status})
              </option>
            ))}
          </select>
        </div>
        <button className="btn-dark" disabled={!selected || loading} onClick={() => selected && runAnalysis(selected)}>
          <Sparkles size={15} /> {loading ? 'Analysing…' : result ? 'Re-analyse' : 'Analyse'}
        </button>
      </div>

      {loading && (
        <div className="card p-12 flex flex-col items-center text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
            className="w-14 h-14 rounded-full border-4 border-veil border-t-ink"
          />
          <div className="font-display font-semibold mt-5">Refinement engine at work</div>
          <p className="text-xs text-mute mt-1">Rewriting steps, weighing drivers, classifying work…</p>
        </div>
      )}

      {error && (
        <div className="card bg-blush/40 border-transparent px-5 py-4 text-sm flex gap-3">
          <TriangleAlert size={16} className="text-warn shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && selected && !loading && (
        <div className="space-y-4 animate-fade-up">
          {/* Score + drivers */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="card bg-ink border-transparent text-white p-6 lg:col-span-2 flex flex-col justify-between">
              <div className="text-xs font-semibold text-white/60">Automation suitability</div>
              <div className="flex items-end gap-2 mt-2">
                <span className="font-display text-6xl font-semibold leading-none">{result.automationSuitability}</span>
                <span className="text-white/50 text-sm mb-1.5">/ 100</span>
              </div>
              <div className="mt-4"><Meter value={result.automationSuitability} /></div>
              <p className="text-xs text-white/60 mt-4 leading-relaxed">{result.drivers.summary}</p>
            </div>
            <div className="card p-6 lg:col-span-3">
              <div className="text-xs font-semibold text-mute mb-4">What drives the score</div>
              <div className="space-y-4">
                {DRIVER_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-sm font-medium w-32 shrink-0">{label}</span>
                    <div className="flex-1"><Meter value={(result.drivers[key] / 5) * 100} tone="veil" /></div>
                    <span className="text-sm font-bold w-8 text-right">{result.drivers[key]}/5</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-line text-sm text-inksoft flex gap-2.5">
                <Sparkles size={15} className="text-veil-deep shrink-0 mt-0.5" />
                <span><strong>Recommended action:</strong> {result.recommendedAction}</span>
              </div>
            </div>
          </div>

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div className="card bg-blush/40 border-transparent px-5 py-4">
              <div className="text-xs font-bold text-warn mb-1.5">Ambiguities &amp; gaps the agent flagged</div>
              <ul className="text-sm text-inksoft space-y-1 list-disc list-inside">
                {result.gaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Refined steps */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <ScanSearch size={15} className="text-veil-deep" /> Refined step specifications
            </h3>
            <div className="mt-4 space-y-3">
              {result.refinedSteps.map((step) => {
                const effective = overrides[step.order] ?? step.aiClassification;
                return (
                  <div key={step.order} className="rounded-2xl border border-line p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-ink text-white grid place-items-center text-[11px] font-bold shrink-0">{step.order}</span>
                        <span className="font-semibold text-sm">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClassChip classification={effective} overridden={Boolean(overrides[step.order] && overrides[step.order] !== step.aiClassification)} />
                        <select
                          className="field !py-1 !px-2.5 !text-[11px] !rounded-full !w-auto cursor-pointer"
                          value={effective}
                          onChange={(e) => setOverrides({ ...overrides, [step.order]: e.target.value as Classification })}
                          aria-label={`Override classification for step ${step.order}`}
                        >
                          {(Object.keys(CLASSIFICATION_META) as Classification[]).map((cls) => (
                            <option key={cls} value={cls}>{CLASSIFICATION_META[cls].label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-mute mt-2.5 leading-relaxed">{step.refinedDescription}</p>
                    <div className="mt-2 text-[11px] text-mute bg-canvas rounded-xl px-3 py-2">
                      <strong>Why:</strong> {step.aiRationale}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-mute">
                Applying updates the catalogue entry: refined wording, classifications, your overrides, gaps and the suitability score.
              </p>
              {applied ? (
                <span className="chip bg-citron-soft border-transparent text-citron-deep !py-2 !px-4">
                  <Check size={13} /> Applied to “{selected.title}”
                </span>
              ) : (
                <button className="btn-citron" onClick={applyResults}>
                  <Check size={15} /> Apply to catalogue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="card p-10 text-center text-sm text-faint">
          Pick a process and hit <strong className="text-mute">Analyse</strong> — results appear here with full reasoning.
        </div>
      )}
    </div>
  );
}
