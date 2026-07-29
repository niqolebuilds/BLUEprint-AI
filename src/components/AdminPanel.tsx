import { useMemo, useState, Fragment } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, Download, Megaphone, Rocket, Send, Trophy, Plus, Edit2, Trash2, Settings2, Search, X, Check, HelpCircle } from 'lucide-react';
import { ImprovementItem, Process, SubFunction, SystemItem } from '../types';
import { MOCK_USERS, SUBFUNCTIONS_LIST } from '../data/mockData';
import { CHART_COLORS, classificationCounts } from '../lib/utils';
import { Meter, Stat, AutoTextarea } from './ui';

const TOOLTIP_STYLE = {
  borderRadius: 14,
  border: '1px solid var(--color-line)',
  background: '#fff',
  boxShadow: 'var(--shadow-lift)',
  fontSize: 12,
  padding: '8px 12px',
};

const READINESS_THRESHOLD = 85;

const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const name = payload.value || '';
  
  // Replace non-breaking spaces back to normal spaces for splitting, if any exist
  const cleanName = name.replace(/\u00A0/g, ' ');
  
  // Split name into words
  const words = cleanName.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  // Simple wrapping logic: group words so that each line is at most 16 characters
  words.forEach((word: string) => {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + word.length + 1 <= 16) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }
  
  const lineHeight = 12;
  const totalHeight = lines.length * lineHeight;
  const startDy = -(totalHeight / 2) + lineHeight / 2 + 3; // +3 is for vertical alignment adjustment

  return (
    <g transform={`translate(${x - 6}, ${y})`}>
      <text
        textAnchor="end"
        fill="var(--color-mute)"
        fontSize="10.5"
        className="font-sans"
      >
        {lines.map((line, idx) => (
          <tspan
            key={idx}
            x={0}
            dy={idx === 0 ? startDy : lineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};


/** Programme admin (US-21/22/23) — hackathon dataset, data quality, next-stage readiness, broadcasts. */
export default function AdminPanel({
  processes,
  availableSystems,
  onUpdateSystems,
  improvementItems,
  onTriggerAdminNotification,
}: {
  processes: Process[];
  availableSystems: SystemItem[];
  onUpdateSystems: (systems: SystemItem[]) => void;
  improvementItems: ImprovementItem[];
  onTriggerAdminNotification: (subject: string, msg: string, type: 'individual' | 'level' | 'subfunction' | 'all', val: string) => void;
}) {
  const [targetType, setTargetType] = useState<'individual' | 'level' | 'subfunction' | 'all'>('level');
  const [targetValue, setTargetValue] = useState('L4');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sentFlash, setSentFlash] = useState(false);

  // System Configuration States
  const [systemSearchQuery, setSystemSearchQuery] = useState('');
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null); // 'new' or specific id
  const [systemNameInput, setSystemNameInput] = useState('');
  const [systemCategoryInput, setSystemCategoryInput] = useState('Enterprise Resource Planning (Financial Core)');
  const [systemDescriptionInput, setSystemDescriptionInput] = useState('');
  const [systemToDelete, setSystemToDelete] = useState<{ id: string; name: string } | null>(null);

  const getProcessCountForSystem = (systemName: string) => {
    return processes.filter(p => 
      p.steps.some(s => s.systems.some(sys => sys.toLowerCase() === systemName.toLowerCase() || sys.toLowerCase().startsWith(systemName.toLowerCase())))
    ).length;
  };

  const handleStartAddSystem = () => {
    setEditingSystemId('new');
    setSystemNameInput('');
    setSystemCategoryInput('Enterprise Resource Planning (Financial Core)');
    setSystemDescriptionInput('');
    setSystemToDelete(null);
  };

  const handleStartEditSystem = (sys: SystemItem) => {
    setEditingSystemId(sys.id);
    setSystemNameInput(sys.name);
    setSystemCategoryInput(sys.category);
    setSystemDescriptionInput(sys.description || '');
    setSystemToDelete(null);
  };

  const handleCancelSystemEdit = () => {
    setEditingSystemId(null);
    setSystemNameInput('');
    setSystemDescriptionInput('');
  };

  const handleSaveSystem = () => {
    if (!systemNameInput.trim()) return;

    if (editingSystemId === 'new') {
      const newSys: SystemItem = {
        id: `sys-${Date.now()}`,
        name: systemNameInput.trim(),
        category: systemCategoryInput,
        processCount: 0,
        description: systemDescriptionInput.trim()
      };
      onUpdateSystems([...availableSystems, newSys]);
    } else {
      const updated = availableSystems.map(s => {
        if (s.id === editingSystemId) {
          return {
            ...s,
            name: systemNameInput.trim(),
            category: systemCategoryInput,
            description: systemDescriptionInput.trim()
          };
        }
        return s;
      });
      onUpdateSystems(updated);
    }

    setEditingSystemId(null);
    setSystemNameInput('');
    setSystemDescriptionInput('');
  };

  const handleDeleteSystem = (id: string, name: string) => {
    setSystemToDelete({ id, name });
  };

  const confirmDeleteSystem = () => {
    if (!systemToDelete) return;
    const filtered = availableSystems.filter(s => s.id !== systemToDelete.id);
    onUpdateSystems(filtered);
    setSystemToDelete(null);
  };

  const filteredSystems = useMemo(() => {
    const q = systemSearchQuery.toLowerCase().trim();
    if (!q) return availableSystems;
    return availableSystems.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.category.toLowerCase().includes(q) || 
      (s.description && s.description.toLowerCase().includes(q))
    );
  }, [availableSystems, systemSearchQuery]);

  const avgCompleteness = processes.length
    ? Math.round(processes.reduce((s, p) => s + p.completenessScore, 0) / processes.length)
    : 0;
  const ready = processes.filter((p) => p.completenessScore >= READINESS_THRESHOLD);
  const counts = classificationCounts(processes);
  const classifiedSteps = counts.automation + counts['agentic-ai'] + counts['human-in-the-loop'];

  const systemsData = useMemo(() => {
    const bySystem = new Map<string, number>();
    for (const p of processes) {
      const touched = new Set(p.steps.flatMap((s) => s.systems));
      for (const sys of touched) bySystem.set(sys, (bySystem.get(sys) ?? 0) + 1);
    }
    return Array.from(bySystem.entries())
      .map(([name, count]) => ({ name: name.replace(/\s*\(.*?\)/, ''), full: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [processes]);

  const hackathonList = [...processes]
    .filter((p) => p.automationSuitability != null)
    .sort((a, b) => (b.automationSuitability ?? 0) - (a.automationSuitability ?? 0))
    .slice(0, 6);

  const lowCompleteness = processes.filter((p) => p.completenessScore < READINESS_THRESHOLD);

  const exportDataset = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), processes, systems: availableSystems, improvementItems }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blueprint-process-dataset.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const chase = (proc: Process) => {
    setTargetType('individual');
    setTargetValue(proc.ownerEmail);
    setSubject(`Please complete "${proc.title}" (${proc.completenessScore}% complete)`);
    setMessage(
      `Hi ${proc.ownerName.split(' ')[0]}, your process "${proc.title}" is at ${proc.completenessScore}% completeness. ` +
        (proc.gaps.length ? `Open gaps: ${proc.gaps.slice(0, 3).join(' ')} ` : '') +
        'Please add the missing detail so it can move to the next transformation stage.',
    );
    document.getElementById('admin-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const send = () => {
    if (!subject.trim() || !message.trim()) return;
    if (targetType !== 'all' && !targetValue.trim()) return;
    onTriggerAdminNotification(subject.trim(), message.trim(), targetType, targetType === 'all' ? 'all' : targetValue.trim());
    setSubject('');
    setMessage('');
    setSentFlash(true);
    setTimeout(() => setSentFlash(false), 2500);
  };

  const readinessPct = Math.round((avgCompleteness / READINESS_THRESHOLD) * 100);

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Programme control room</h2>
          <p className="text-sm text-mute mt-0.5">Data quality, the hackathon dataset and next-stage readiness — all in one place.</p>
        </div>
        <button className="btn-ghost" onClick={exportDataset}>
          <Download size={15} /> Export dataset
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Processes captured" value={processes.length} hint={`${classifiedSteps} classified steps`} accent="citron" />
        <Stat label="Dataset completeness" value={`${avgCompleteness}%`} hint={`threshold ${READINESS_THRESHOLD}% for next stage`} />
        <Stat label="Ready for next stage" value={ready.length} hint="processes at threshold" accent="veil" />
        <Stat label="Systems mapped" value={availableSystems.length} hint="in the master catalogue" />
      </div>

      {/* Transformation readiness */}
      <div className="card bg-ink border-transparent text-white p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <Rocket size={15} className="text-citron" /> Next-stage readiness · data clean-up &amp; agentic deployment
          </h3>
          <span className="text-xs text-white/60">{Math.min(100, readinessPct)}% of the way there</span>
        </div>
        <div className="mt-4"><Meter value={Math.min(100, readinessPct)} /></div>
        <p className="text-xs text-white/60 mt-3 leading-relaxed max-w-2xl">
          {avgCompleteness >= READINESS_THRESHOLD
            ? 'Threshold met — export the dataset and kick off the data clean-up stage with the ranked candidates below.'
            : `Dataset completeness is ${avgCompleteness}%. Chase the low-completeness processes below to unlock the next stage at ${READINESS_THRESHOLD}%.`}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Systems analytics */}
        <div className="card p-6">
          <h3 className="font-display font-semibold text-sm">Processes per system</h3>
          <p className="text-xs text-mute mt-0.5 mb-4">Where the work actually happens</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={systemsData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 10.5, fill: 'var(--color-mute)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={135} tick={<CustomYAxisTick />} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(23,23,28,0.04)' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: any) => [`${value} process${value === 1 ? '' : 'es'}`, 'Touches']}
                labelFormatter={(_, payload) => (payload?.[0]?.payload as any)?.full ?? ''}
              />
              <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hackathon list */}
        <div className="card p-6">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <Trophy size={15} className="text-citron-deep" /> Hackathon challenge list
          </h3>
          <p className="text-xs text-mute mt-0.5">Ranked by automation suitability — the most impactful AI interventions first.</p>
          <ol className="mt-4 space-y-2.5">
            {hackathonList.length === 0 && (
              <li className="text-sm text-faint py-6 text-center">Run AI refinement on captured processes to build the list.</li>
            )}
            {hackathonList.map((proc, i) => (
              <li key={proc.id} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
                <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-citron text-ink' : 'bg-canvas text-mute'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{proc.title}</div>
                  <div className="text-[11px] text-faint truncate">{proc.subFunction}</div>
                </div>
                <span className="chip bg-veil-soft border-transparent text-veil-deep shrink-0">{proc.automationSuitability}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* System & Tool Configuration (AI Context Registry) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-line">
          <div>
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <Settings2 size={15} className="text-veil-deep" /> Systems &amp; Tools Registry
            </h3>
            <p className="text-xs text-mute mt-0.5">
              Manage the employee tech stack context database. These descriptions feed directly into the AI engine to propose custom API integrations, agentic automation, and workflows.
            </p>
          </div>
          <button
            onClick={handleStartAddSystem}
            className="btn-dark flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs"
          >
            <Plus size={13} /> Add New System
          </button>
        </div>

        {/* Add/Edit Inline Form (for adding new systems) */}
        {editingSystemId === 'new' && (
          <div className="bg-canvas border border-line rounded-2xl p-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-line/60">
              <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">
                Add New System
              </h4>
              <button
                onClick={handleCancelSystemEdit}
                className="text-mute hover:text-ink cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label text-xs font-semibold" htmlFor="sys-name">System/Tool Name</label>
                <input
                  id="sys-name"
                  type="text"
                  className="field text-xs mt-1"
                  placeholder="e.g. Workday HCM"
                  value={systemNameInput}
                  onChange={(e) => setSystemNameInput(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs font-semibold" htmlFor="sys-cat">Classification Category</label>
                <select
                  id="sys-cat"
                  className="field cursor-pointer text-xs mt-1"
                  value={systemCategoryInput}
                  onChange={(e) => setSystemCategoryInput(e.target.value)}
                >
                  <option value="Enterprise Resource Planning (Financial Core)">ERP (Financial Core)</option>
                  <option value="Procurement E-System">Procurement E-System</option>
                  <option value="Tax Compliance Portal">Tax Compliance Portal</option>
                  <option value="Clinical Data Layer">Clinical Data Layer</option>
                  <option value="Insurance / Reinsurance Portal">Insurance / Reinsurance Portal</option>
                  <option value="Corporate Banking Platform">Corporate Banking Platform</option>
                  <option value="Analytics & Presentation Layer">Analytics & Presentation Layer</option>
                  <option value="Custom System / Legacy App">Custom System / Legacy App</option>
                  <option value="Other Productivity Tool">Other Productivity Tool</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold" htmlFor="sys-desc">
                AI Context &amp; Capabilities (API interfaces, bottlenecks, data flow parameters)
              </label>
              <AutoTextarea
                id="sys-desc"
                className="field min-h-20 text-xs mt-1"
                placeholder="Describe how this system operates, available API endpoints, manual bottlenecks, security restrictions, or how the AI should propose agentic and robotic solutions for it."
                value={systemDescriptionInput}
                onChange={(e) => setSystemDescriptionInput(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelSystemEdit}
                className="btn-ghost !py-2 !px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSystem}
                className="btn-dark !py-2 !px-4 text-xs flex items-center gap-1.5"
                disabled={!systemNameInput.trim()}
              >
                <Check size={14} /> Save System
              </button>
            </div>
          </div>
        )}

        {/* Search Filter */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            className="field !pl-9 text-xs"
            placeholder="Search systems, categories, or capabilities..."
            value={systemSearchQuery}
            onChange={(e) => setSystemSearchQuery(e.target.value)}
          />
        </div>

        {/* Systems List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-mute font-medium">
                <th className="py-2.5 px-3">System Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">AI Context &amp; Automation Hook</th>
                <th className="py-2.5 px-3 text-center">Touch Count</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSystems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-faint">
                    No registered systems matched your search query.
                  </td>
                </tr>
              ) : (
                filteredSystems.map((sys) => {
                  const touches = getProcessCountForSystem(sys.name);
                  const isBeingEdited = editingSystemId === sys.id;
                  const isBeingDeleted = systemToDelete?.id === sys.id;
                  return (
                    <Fragment key={sys.id}>
                      <tr className={`border-b border-line/60 hover:bg-canvas-soft/30 transition-colors ${(isBeingEdited || isBeingDeleted) ? 'bg-veil-soft/10' : ''}`}>
                        <td className="py-3 px-3 font-medium text-ink">{sys.name}</td>
                        <td className="py-3 px-3">
                          <span className="chip bg-veil-soft border-transparent text-veil-deep whitespace-nowrap text-[10px]">
                            {sys.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-mute max-w-xs truncate" title={sys.description || 'No specific AI context provided.'}>
                          {sys.description || (
                            <span className="text-faint italic font-normal">
                              No custom AI context defined. Proposing general integrations.
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1.5 text-[10px] font-bold ${touches > 0 ? 'bg-citron text-ink font-semibold' : 'bg-canvas text-faint border border-line'}`}>
                            {touches}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleStartEditSystem(sys)}
                              className={`w-7 h-7 rounded-full hover:bg-veil flex items-center justify-center transition-colors cursor-pointer ${isBeingEdited ? 'bg-citron text-ink font-semibold' : 'text-mute hover:text-ink'}`}
                              title="Edit system config"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteSystem(sys.id, sys.name)}
                              className={`w-7 h-7 rounded-full hover:bg-bad/10 flex items-center justify-center transition-colors cursor-pointer ${isBeingDeleted ? 'bg-bad text-white' : 'text-mute hover:text-bad'}`}
                              title="Delete system"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isBeingEdited && (
                        <tr className="bg-canvas/50 border-b border-line/60 animate-fade-in">
                          <td colSpan={5} className="py-4 px-4 bg-veil-soft/5">
                            <div className="bg-canvas border border-line rounded-2xl p-4 space-y-4 shadow-sm">
                              <div className="flex items-center justify-between pb-2 border-b border-line/60">
                                <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">
                                  Edit "{sys.name}" Registry
                                </h4>
                                <button
                                  onClick={handleCancelSystemEdit}
                                  className="text-mute hover:text-ink cursor-pointer"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="label text-xs font-semibold" htmlFor={`sys-name-${sys.id}`}>System/Tool Name</label>
                                  <input
                                    id={`sys-name-${sys.id}`}
                                    type="text"
                                    className="field text-xs mt-1"
                                    placeholder="e.g. Workday HCM"
                                    value={systemNameInput}
                                    onChange={(e) => setSystemNameInput(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="label text-xs font-semibold" htmlFor={`sys-cat-${sys.id}`}>Classification Category</label>
                                  <select
                                    id={`sys-cat-${sys.id}`}
                                    className="field cursor-pointer text-xs mt-1"
                                    value={systemCategoryInput}
                                    onChange={(e) => setSystemCategoryInput(e.target.value)}
                                  >
                                    <option value="Enterprise Resource Planning (Financial Core)">ERP (Financial Core)</option>
                                    <option value="Procurement E-System">Procurement E-System</option>
                                    <option value="Tax Compliance Portal">Tax Compliance Portal</option>
                                    <option value="Clinical Data Layer">Clinical Data Layer</option>
                                    <option value="Insurance / Reinsurance Portal">Insurance / Reinsurance Portal</option>
                                    <option value="Corporate Banking Platform">Corporate Banking Platform</option>
                                    <option value="Analytics & Presentation Layer">Analytics & Presentation Layer</option>
                                    <option value="Custom System / Legacy App">Custom System / Legacy App</option>
                                    <option value="Other Productivity Tool">Other Productivity Tool</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="label text-xs font-semibold" htmlFor={`sys-desc-${sys.id}`}>
                                  AI Context &amp; Capabilities (API interfaces, bottlenecks, data flow parameters)
                                </label>
                                <AutoTextarea
                                  id={`sys-desc-${sys.id}`}
                                  className="field min-h-20 text-xs mt-1"
                                  placeholder="Describe how this system operates, available API endpoints, manual bottlenecks, security restrictions, or how the AI should propose agentic and robotic solutions for it."
                                  value={systemDescriptionInput}
                                  onChange={(e) => setSystemDescriptionInput(e.target.value)}
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                  type="button"
                                  onClick={handleCancelSystemEdit}
                                  className="btn-ghost !py-2 !px-4 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveSystem}
                                  className="btn-dark !py-2 !px-4 text-xs flex items-center gap-1.5"
                                  disabled={!systemNameInput.trim()}
                                >
                                  <Check size={14} /> Save System
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isBeingDeleted && (
                        <tr className="bg-bad/5 border-b border-line/40 animate-fade-in">
                          <td colSpan={5} className="py-4 px-4 bg-bad/5">
                            <div className="bg-canvas border border-bad/30 rounded-2xl p-4 space-y-3 shadow-sm">
                              <div className="flex items-start gap-2.5">
                                <HelpCircle size={16} className="text-bad mt-0.5" />
                                <div>
                                  <h4 className="font-semibold text-xs text-ink">Delete "{systemToDelete.name}" from registry?</h4>
                                  <p className="text-[11px] text-mute mt-1">
                                    Are you sure you want to delete this system? Deleting it will remove its specific AI capabilities descriptions, although existing step records referencing its name will remain untouched.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setSystemToDelete(null)}
                                  className="btn-ghost !py-1.5 !px-3.5 !text-[11px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={confirmDeleteSystem}
                                  className="btn-dark !bg-bad hover:!bg-bad/90 !text-white !py-1.5 !px-3.5 !text-[11px]"
                                >
                                  Yes, Delete System
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data quality */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Database size={15} className="text-veil-deep" /> Data quality — completeness gaps
        </h3>
        {lowCompleteness.length === 0 ? (
          <p className="text-sm text-faint mt-3">Every captured process is at or above the {READINESS_THRESHOLD}% threshold. 🎯</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {lowCompleteness.map((proc) => (
              <li key={proc.id} className="flex items-center gap-4 rounded-2xl border border-line px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-40">
                  <div className="text-sm font-medium truncate">{proc.title}</div>
                  <div className="text-[11px] text-faint">{proc.ownerName} · {proc.gaps.length} open gap{proc.gaps.length === 1 ? '' : 's'}</div>
                </div>
                <div className="w-36 flex items-center gap-2">
                  <div className="flex-1"><Meter value={proc.completenessScore} /></div>
                  <span className="text-xs font-bold">{proc.completenessScore}%</span>
                </div>
                <button className="btn-ghost !py-1.5 !px-3.5 !text-[11px]" onClick={() => chase(proc)}>
                  <Megaphone size={11} /> Chase owner
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div id="admin-composer" className="card p-6">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Send size={15} className="text-veil-deep" /> Notify by level, line-of-work or individual
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label" htmlFor="adm-type">Audience</label>
            <select
              id="adm-type"
              className="field cursor-pointer"
              value={targetType}
              onChange={(e) => {
                const t = e.target.value as typeof targetType;
                setTargetType(t);
                setTargetValue(t === 'level' ? 'L4' : t === 'subfunction' ? SUBFUNCTIONS_LIST[0]! : '');
              }}
            >
              <option value="individual">Individual</option>
              <option value="level">Level</option>
              <option value="subfunction">Line of work</option>
              <option value="all">Everyone</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="adm-target">Target</label>
            {targetType === 'level' ? (
              <select id="adm-target" className="field cursor-pointer" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
                {['L1', 'L2', 'L3', 'L4'].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            ) : targetType === 'subfunction' ? (
              <select id="adm-target" className="field cursor-pointer" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
                {SUBFUNCTIONS_LIST.map((sf: SubFunction) => <option key={sf} value={sf}>{sf}</option>)}
              </select>
            ) : targetType === 'individual' ? (
              <>
                <input id="adm-target" className="field" list="adm-emails" placeholder="person@company.com" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
                <datalist id="adm-emails">
                  {MOCK_USERS.map((u) => <option key={u.id} value={u.email} />)}
                </datalist>
              </>
            ) : (
              <input className="field" value="All registered users" disabled />
            )}
          </div>
        </div>
        <div className="mt-3.5">
          <label className="label" htmlFor="adm-subject">Subject</label>
          <input id="adm-subject" className="field" placeholder="e.g. Reminder: documentation deadline Friday" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="mt-3.5">
          <label className="label" htmlFor="adm-msg">Message</label>
          <AutoTextarea id="adm-msg" className="field min-h-24" placeholder="What do you need from them?" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {sentFlash && <span className="text-xs font-semibold text-ok animate-fade-up">Sent — logged in broadcast history ✓</span>}
          <button
            className="btn-dark"
            onClick={send}
            disabled={!subject.trim() || !message.trim() || (targetType !== 'all' && !targetValue.trim())}
          >
            <Send size={14} /> Send notification
          </button>
        </div>
      </div>
    </div>
  );
}
