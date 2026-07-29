import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { DraftProcess, ProcessStep, SubFunction, SystemItem } from '../../types';
import { computeCompleteness, stepGaps, uid } from '../../lib/utils';
import { ClassChip, Meter, TagList, AutoTextarea } from '../ui';
import { MOCK_USERS, SUBFUNCTIONS_LIST } from '../../data/mockData';

function AttributeEditor({
  label,
  values,
  placeholder,
  onChange,
  suggestions,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');
  const listId = suggestions ? `sugg-${label.replace(/\s+/g, '-').toLowerCase()}-${uid('l')}` : undefined;

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };

  return (
    <div>
      <div className="label !mb-1.5">{label}</div>
      <TagList items={values} onRemove={(item) => onChange(values.filter((v) => v !== item))} />
      <div className="flex gap-1.5 mt-1.5">
        <input
          className="field !py-1.5 !px-3 !text-xs !rounded-full"
          placeholder={placeholder}
          value={draft}
          list={listId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button type="button" onClick={add} className="btn-ghost !p-1.5 !rounded-full shrink-0" aria-label={`Add ${label}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

/** Editor for a single mined process — title, line of work, steps, collaboration. */
function ProcessEditor({
  process,
  index,
  total,
  onChange,
  onDelete,
  systemNames,
  onAddSystem,
}: {
  process: DraftProcess;
  index: number;
  total: number;
  onChange: (updated: DraftProcess) => void;
  onDelete: () => void;
  systemNames: string[];
  onAddSystem: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(process.steps[0]?.id ?? null);
  const completeness = computeCompleteness({
    title: process.title,
    description: process.summary || process.title,
    steps: process.steps,
  });

  const setSteps = (steps: ProcessStep[]) => onChange({ ...process, steps: steps.map((s, i) => ({ ...s, order: i + 1 })) });
  const updateStep = (id: string, patch: Partial<ProcessStep>) =>
    setSteps(process.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const reorder = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= process.steps.length) return;
    const next = [...process.steps];
    [next[i], next[target]] = [next[target]!, next[i]!];
    setSteps(next);
  };

  const duplicateStep = (step: ProcessStep, i: number) => {
    const copy: ProcessStep = { ...step, id: uid('step'), name: `${step.name} (copy)` };
    setSteps([...process.steps.slice(0, i + 1), copy, ...process.steps.slice(i + 1)]);
  };

  const removeStep = (id: string) => setSteps(process.steps.filter((s) => s.id !== id));

  const addStep = () => {
    const step: ProcessStep = {
      id: uid('step'),
      order: process.steps.length + 1,
      name: '',
      description: '',
      inputs: [],
      outputs: [],
      decisionPoints: [],
      systems: [],
      handOffs: [],
    };
    setSteps([...process.steps, step]);
    setExpanded(step.id);
  };

  return (
    <div className="card p-5 sm:p-6">
      {/* Process header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-veil-deep">
          <span className="w-6 h-6 rounded-full bg-veil-soft grid place-items-center">
            <Layers size={13} />
          </span>
          Process {index + 1} of {total}
        </div>
        {total > 1 && (
          <button
            onClick={onDelete}
            className="text-xs text-faint hover:text-bad flex items-center gap-1 cursor-pointer"
            title="Remove this process"
          >
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>

      <div className="mt-4 grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Process title</label>
          <input
            className="field"
            value={process.title}
            onChange={(e) => onChange({ ...process, title: e.target.value })}
            placeholder="Name this process"
          />
        </div>
        <div>
          <label className="label">Line of work</label>
          <select
            className="field cursor-pointer"
            value={process.subFunction}
            onChange={(e) => onChange({ ...process, subFunction: e.target.value as SubFunction })}
          >
            <option value="" disabled>
              Choose a line of work…
            </option>
            {SUBFUNCTIONS_LIST.map((sf) => (
              <option key={sf} value={sf}>
                {sf}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Manual Role Override <span className="text-faint font-normal">(optional)</span></label>
          <input
            className="field"
            value={process.manualRoleOverride || ''}
            onChange={(e) => onChange({ ...process, manualRoleOverride: e.target.value })}
            placeholder="e.g. CFO Consultant"
            title="Dedicated Role override field. Accepts raw manual user input only, completely bypassing AI editing/validation."
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <Meter value={completeness} />
        </div>
        <span className="text-xs font-semibold text-mute whitespace-nowrap">{completeness}% complete</span>
      </div>

      {/* Step cards */}
      <div className="mt-4 space-y-3">
        {process.steps.map((step, i) => {
          const gaps = stepGaps(step);
          const isOpen = expanded === step.id;
          return (
            <div key={step.id} className={`rounded-2xl border border-line bg-card overflow-hidden transition-shadow ${isOpen ? 'shadow-lift' : ''}`}>
              <div className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none" onClick={() => setExpanded(isOpen ? null : step.id)}>
                <span className="w-7 h-7 rounded-full bg-ink text-white grid place-items-center text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {step.name || <span className="text-faint font-normal">Untitled step — open to edit</span>}
                  </div>
                  {!isOpen && gaps.length > 0 && <div className="text-[11px] text-warn mt-0.5">Missing: {gaps.join(', ')}</div>}
                </div>
                {step.aiClassification && <ClassChip classification={step.aiClassification} />}
                <div className="flex items-center gap-0.5 text-faint" onClick={(e) => e.stopPropagation()}>
                  <button className="p-1.5 hover:text-ink cursor-pointer disabled:opacity-30" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                  <button className="p-1.5 hover:text-ink cursor-pointer disabled:opacity-30" disabled={i === process.steps.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                  <button className="p-1.5 hover:text-ink cursor-pointer" onClick={() => duplicateStep(step, i)} aria-label="Duplicate step"><Copy size={14} /></button>
                  <button className="p-1.5 hover:text-bad cursor-pointer" onClick={() => removeStep(step.id)} aria-label="Delete step"><Trash2 size={14} /></button>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-5 pt-1 border-t border-line animate-fade-up">
                  <div className="grid sm:grid-cols-[1fr_220px] gap-4 mt-4">
                    <div>
                      <label className="label">Step name</label>
                      <input className="field !py-2" value={step.name} onChange={(e) => updateStep(step.id, { name: e.target.value })} placeholder="What happens in this step?" />
                    </div>
                    <div>
                      <label className="label">Best handled by</label>
                      <select
                        className="field !py-2 cursor-pointer"
                        value={step.aiClassification ?? ''}
                        onChange={(e) => updateStep(step.id, { aiClassification: (e.target.value || undefined) as ProcessStep['aiClassification'] })}
                      >
                        <option value="">Not classified yet</option>
                        <option value="automation">Automation</option>
                        <option value="agentic-ai">Agentic AI</option>
                        <option value="human-in-the-loop">Human-in-the-loop</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="label">Description <span className="text-faint font-normal">(trigger → action → result)</span></label>
                    <AutoTextarea className="field !py-2 min-h-20 resize-y text-sm" value={step.description} onChange={(e) => updateStep(step.id, { description: e.target.value })} />
                  </div>
                  {step.aiRationale && (
                    <div className="mt-2 text-[11px] text-mute bg-canvas rounded-xl px-3 py-2">
                      <Sparkles size={11} className="inline mr-1 text-veil-deep" />
                      {step.aiRationale}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
                    <AttributeEditor label="Inputs" values={step.inputs} placeholder="e.g. Vendor invoice PDF" onChange={(v) => updateStep(step.id, { inputs: v })} />
                    <AttributeEditor label="Outputs" values={step.outputs} placeholder="e.g. Verified claims file" onChange={(v) => updateStep(step.id, { outputs: v })} />
                    <AttributeEditor label="Decision points" values={step.decisionPoints} placeholder="e.g. Does the tariff match?" onChange={(v) => updateStep(step.id, { decisionPoints: v })} />
                    <AttributeEditor label="Hand-offs" values={step.handOffs} placeholder="e.g. Escalate to controller" onChange={(v) => updateStep(step.id, { handOffs: v })} />
                    <div className="sm:col-span-2">
                      <AttributeEditor
                        label="Systems used"
                        values={step.systems}
                        placeholder="Start typing — pick from the list or add a new system"
                        suggestions={systemNames}
                        onChange={(v) => {
                          for (const name of v) {
                            if (!systemNames.includes(name)) onAddSystem(name);
                          }
                          updateStep(step.id, { systems: v });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={addStep} className="btn-ghost w-full mt-3 border-dashed">
        <Plus size={15} /> Add a step manually
      </button>

      {/* Collaboration */}
      <div className="mt-4 rounded-2xl border border-line px-4 py-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" className="accent-[#16233a] w-4 h-4" checked={process.isShared} onChange={(e) => onChange({ ...process, isShared: e.target.checked })} />
          <span className="text-sm font-medium flex items-center gap-2">
            <UsersRound size={15} className="text-veil-deep" /> Shared process — others work on it too
          </span>
        </label>
        {process.isShared && (
          <div className="mt-3 animate-fade-up">
            <AttributeEditor
              label="Tag collaborators (they'll be linked & notified)"
              values={process.taggedUsers}
              placeholder="colleague@company.com"
              suggestions={MOCK_USERS.map((u) => u.email)}
              onChange={(v) => onChange({ ...process, taggedUsers: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewSteps({
  processes,
  setProcesses,
  overallSummary,
  availableSystems,
  onAddSystem,
  onBack,
  onConfirm,
}: {
  processes: DraftProcess[];
  setProcesses: (processes: DraftProcess[]) => void;
  overallSummary: string | null;
  availableSystems: SystemItem[];
  onAddSystem: (name: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const systemNames = availableSystems.map((s) => s.name);
  const totalSteps = processes.reduce((n, p) => n + p.steps.length, 0);

  const updateProcess = (id: string, updated: DraftProcess) => setProcesses(processes.map((p) => (p.id === id ? updated : p)));
  const deleteProcess = (id: string) => setProcesses(processes.filter((p) => p.id !== id));

  const addProcess = () => {
    setProcesses([
      ...processes,
      {
        id: uid('proc'),
        title: '',
        subFunction: '',
        summary: '',
        steps: [
          {
            id: uid('step'),
            order: 1,
            name: '',
            description: '',
            inputs: [],
            outputs: [],
            decisionPoints: [],
            systems: [],
            handOffs: [],
          },
        ],
        isShared: false,
        taggedUsers: [],
      },
    ]);
  };

  const canConfirm =
    processes.length > 0 &&
    processes.every((p) => p.title.trim().length > 0 && p.steps.length > 0 && p.steps.every((s) => s.name.trim()));

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Here&rsquo;s what I understood</h2>
      <p className="text-sm text-mute mt-1.5 max-w-lg">
        I split your description into <strong>{processes.length} distinct process{processes.length === 1 ? '' : 'es'}</strong> ({totalSteps}{' '}
        step{totalSteps === 1 ? '' : 's'} in total). Rename anything, fix what I misread, or split further — each process saves separately.
      </p>

      {overallSummary && (
        <div className="mt-5 card bg-veil-soft border-transparent px-5 py-4 text-sm text-inksoft flex gap-3">
          <Sparkles size={16} className="text-veil-deep shrink-0 mt-0.5" />
          <span>{overallSummary}</span>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {processes.map((p, i) => (
          <ProcessEditor
            key={p.id}
            process={p}
            index={i}
            total={processes.length}
            onChange={(updated) => updateProcess(p.id, updated)}
            onDelete={() => deleteProcess(p.id)}
            systemNames={systemNames}
            onAddSystem={onAddSystem}
          />
        ))}
      </div>

      <button onClick={addProcess} className="btn-ghost w-full mt-5 border-dashed">
        <Plus size={15} /> Add another process
      </button>

      <div className="mt-8 flex items-center justify-between">
        <button className="btn-ghost !py-2 !px-4 text-xs" onClick={onBack}>
          <ArrowLeft size={14} /> Re-describe
        </button>
        <button
          className="btn-dark"
          onClick={onConfirm}
          disabled={!canConfirm}
          title={canConfirm ? undefined : 'Every process needs a title, and every step needs a name'}
        >
          Looks right — save {processes.length} process{processes.length === 1 ? '' : 'es'} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
