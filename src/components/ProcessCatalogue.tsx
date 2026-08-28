import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  GitBranch,
  Layers,
  Lock,
  PencilLine,
  Plus,
  Printer,
  Search,
  Trash2,
  UsersRound,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  CheckCircle2,
  Copy,
  Check,
  Megaphone,
  ShieldCheck,
  HeartHandshake,
  CreditCard,
  Activity,
  Save,
  Download,
} from 'lucide-react';
import { Persona, Process, SystemItem, DeploymentPlan } from '../types';
import { SUBFUNCTIONS_LIST } from '../data/mockData';
import { timeAgo } from '../lib/utils';
import { Avatar, ClassChip, EmptyState, Meter, StatusChip } from './ui';
import FinanceRoiTcoPanel from './FinanceRoiTcoPanel';
import VprsPdfPanel from './VprsPdfPanel';

function ProcessDetail({
  proc,
  availableSystems,
  onBack,
  onEdit,
  onDelete,
  currentPersona,
  profileName,
  profileRole,
  onSaveProcess,
}: {
  proc: Process;
  availableSystems: SystemItem[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  currentPersona: Persona;
  profileName: string;
  profileRole?: Persona;
  onSaveProcess?: (proc: Process) => void;
}) {
  const [plan, setPlan] = useState<DeploymentPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<number[]>([0]); // first phase open by default
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // USD to IDR conversion — used below only for the roadmap's tool-subscription
  // cost display. The ROI/TCO engine (FinanceRoiTcoPanel) uses its own
  // configurable FX rate sourced from the shared pricing table.
  const toIDR = (usd: number) => usd * 16000;
  const formatIDR = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const isRoadmapSaved = !!(
    proc.savedDeploymentPlan &&
    plan &&
    JSON.stringify(proc.savedDeploymentPlan) === JSON.stringify(plan)
  );

  const handleSaveRoadmap = () => {
    if (plan && onSaveProcess) {
      onSaveProcess({
        ...proc,
        savedDeploymentPlan: plan,
      });
    }
  };
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string>('');

  const systems = Array.from(new Set(proc.steps.flatMap((s) => s.systems)));

  // RBAC permissions check:
  // - L2, L3, and Admins maintain global write permissions.
  // - L1 and L4 can only edit self-created/owned processes.
  const isGlobalWriter = currentPersona === 'L2' || currentPersona === 'L3' || currentPersona === 'Admin' || profileRole === 'Admin';
  const isOwner = proc.ownerName === profileName;
  const canModify = isGlobalWriter || isOwner;

  const currentKey = `${proc.id}-${proc.lastUpdated}-${proc.steps.map(s => s.aiClassification || s.name).join(',')}-${availableSystems.length}`;

  const handleTogglePhase = (index: number) => {
    if (expandedPhases.includes(index)) {
      setExpandedPhases(expandedPhases.filter(i => i !== index));
    } else {
      setExpandedPhases([...expandedPhases, index]);
    }
  };

  const handleToggleCheck = (key: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const generateDeploymentPlan = async () => {
    setLoadingPlan(true);
    setErrorPlan(null);
    try {
      const response = await fetch('/api/ai/propose-deployment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proc.title,
          description: proc.description,
          steps: proc.steps,
          effortRating: proc.effortRating,
          volumeRating: proc.volumeRating,
          repetitivenessRating: proc.repetitivenessRating,
          errorSensitivityRating: proc.errorSensitivityRating,
          availableSystems: availableSystems
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate deployment plan from the blueprint server.');
      }

      const data = await response.json();
      setPlan(data);
      setLastGeneratedKey(currentKey);
    } catch (err: any) {
      setErrorPlan(err.message || 'An error occurred while generating deployment options.');
    } finally {
      setLoadingPlan(false);
    }
  };

  // Reset or load saved plan when switching processes to prevent flash of stale content
  useEffect(() => {
    if (proc.savedDeploymentPlan) {
      setPlan(proc.savedDeploymentPlan);
      setLastGeneratedKey(currentKey);
    } else {
      setPlan(null);
      setLastGeneratedKey('');
    }
    setErrorPlan(null);
  }, [proc.id, proc.savedDeploymentPlan]);

  // Pre-generate the plan if the process is refined/approved and we do not have a plan yet (and no saved plan exists)
  useEffect(() => {
    if (!plan && !loadingPlan && !errorPlan && !proc.savedDeploymentPlan && (proc.status === 'Refined' || proc.status === 'Approved')) {
      generateDeploymentPlan();
    }
  }, [proc.id, proc.status, proc.savedDeploymentPlan]);

  // Automatically regenerate when the underlying inputs (steps, description, systems) change (only if no saved plan exists)
  useEffect(() => {
    if (plan && lastGeneratedKey && lastGeneratedKey !== currentKey && !loadingPlan && !proc.savedDeploymentPlan) {
      generateDeploymentPlan();
    }
  }, [proc, availableSystems]);

  return (
    <div id="process-detail-view" className="animate-fade-up space-y-4">
      <button onClick={onBack} className="btn-ghost !py-2 !px-4 text-xs print:hidden">
        <ArrowLeft size={13} /> All processes
      </button>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip status={proc.status} />
              <span className="chip">{proc.subFunction}</span>
              {proc.isShared && (
                <span className="chip bg-veil-soft border-transparent text-veil-deep">
                  <UsersRound size={11} /> Shared
                </span>
              )}
              {!canModify && (
                <span className="chip bg-bad/10 border-bad/30 text-bad flex items-center gap-1 font-semibold animate-pulse">
                  <Lock size={11} /> View-Only (Locked)
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight mt-3 leading-snug">{proc.title}</h2>
            <p className="text-sm text-mute mt-2 leading-relaxed max-w-2xl">{proc.description}</p>
          </div>
          <div className="flex gap-2 shrink-0 print:hidden">
            <button onClick={() => window.print()} className="btn-ghost !p-2.5" title="Export / print (PDF)" aria-label="Export or print">
              <Printer size={15} />
            </button>
            <button
              onClick={onEdit}
              disabled={!canModify}
              className={`btn-ghost !py-2.5 !px-4 text-xs ${
                !canModify ? 'opacity-50 cursor-not-allowed border-line text-mute bg-veil-soft/30' : ''
              }`}
              title={!canModify ? 'This process is shared and locked for your tier' : 'Edit process details'}
            >
              {canModify ? <PencilLine size={13} /> : <Lock size={13} className="text-bad" />}
              {canModify ? 'Edit' : 'View-Only (Locked)'}
            </button>
            {canModify && (
              <button onClick={onDelete} className="btn-ghost !p-2.5 hover:!border-bad hover:text-bad" title="Delete" aria-label="Delete process">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mt-6 pt-5 border-t border-line">
          <div>
            <div className="label">Owner</div>
            <div className="flex items-center gap-2">
              <Avatar name={proc.ownerName} size={26} />
              <div>
                <div className="text-sm font-medium leading-tight">{proc.ownerName}</div>
                <div className="text-[11px] text-faint">
                  {proc.manualRoleOverride ? (
                    <span className="text-citron-deep font-semibold" title="Manually overridden role">{proc.manualRoleOverride}</span>
                  ) : (
                    proc.ownerLevel
                  )} · {timeAgo(proc.lastUpdated)}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="label">Completeness</div>
            <div className="flex items-center gap-2">
              <div className="flex-1"><Meter value={proc.completenessScore} /></div>
              <span className="text-sm font-bold">{proc.completenessScore}%</span>
            </div>
          </div>
          <div>
            <div className="label">Automation suitability</div>
            {proc.automationSuitability != null ? (
              <div className="flex items-center gap-2">
                <div className="flex-1"><Meter value={proc.automationSuitability} tone="veil" /></div>
                <span className="text-sm font-bold">{proc.automationSuitability}</span>
              </div>
            ) : (
              <span className="text-xs text-faint">Run AI refinement to score</span>
            )}
          </div>
          <div>
            <div className="label">Collaborators</div>
            <div className="text-xs text-inksoft">
              {proc.taggedUsers.length ? proc.taggedUsers.join(', ') : <span className="text-faint">None tagged</span>}
            </div>
          </div>
        </div>
      </div>

      {proc.gaps.length > 0 && (
        <div className="card bg-blush/40 border-transparent px-5 py-4">
          <div className="text-xs font-bold text-warn mb-1.5">Open gaps flagged for completion</div>
          <ul className="text-sm text-inksoft space-y-1 list-disc list-inside">
            {proc.gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step timeline */}
      <div className="card p-6 print:break-inside-avoid">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <GitBranch size={16} className="text-veil-deep" /> Workflow steps
          <span className="text-mute font-normal text-sm">({proc.steps.length})</span>
        </h3>
        <ol className="mt-5 relative">
          {proc.steps.map((step, i) => {
            const cls = proc.userOverrides?.[step.id] ?? step.aiClassification;
            return (
              <li key={step.id} className="relative pl-12 pb-7 last:pb-0 print:break-inside-avoid">
                {i < proc.steps.length - 1 && (
                  <span className="absolute left-[15px] top-9 bottom-0 w-px bg-line" aria-hidden />
                )}
                <span className="absolute left-0 top-0.5 w-8 h-8 rounded-full bg-ink text-white grid place-items-center text-xs font-bold">
                  {step.order}
                </span>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="font-semibold text-sm">{step.name}</div>
                  {cls && <ClassChip classification={cls} overridden={Boolean(proc.userOverrides?.[step.id])} />}
                </div>
                <p className="text-sm text-mute mt-1.5 leading-relaxed max-w-2xl">{step.description}</p>
                <div className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-2 max-w-2xl">
                  {step.inputs.length > 0 && (
                    <div className="text-xs">
                      <span className="font-semibold text-mute inline-flex items-center gap-1"><ArrowDownRight size={11} /> In:</span>{' '}
                      <span className="text-inksoft">{step.inputs.join(', ')}</span>
                    </div>
                  )}
                  {step.outputs.length > 0 && (
                    <div className="text-xs">
                      <span className="font-semibold text-mute inline-flex items-center gap-1"><ArrowUpRight size={11} /> Out:</span>{' '}
                      <span className="text-inksoft">{step.outputs.join(', ')}</span>
                    </div>
                  )}
                  {step.decisionPoints.length > 0 && (
                    <div className="text-xs sm:col-span-2">
                      <span className="font-semibold text-mute">Decisions:</span>{' '}
                      <span className="text-inksoft">{step.decisionPoints.join(' · ')}</span>
                    </div>
                  )}
                  {step.handOffs.length > 0 && (
                    <div className="text-xs sm:col-span-2">
                      <span className="font-semibold text-mute">Hand-offs:</span>{' '}
                      <span className="text-inksoft">{step.handOffs.join(' · ')}</span>
                    </div>
                  )}
                </div>
                {step.systems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {step.systems.map((sys) => (
                      <span key={sys} className="chip !text-[11px]">{sys}</span>
                    ))}
                  </div>
                )}
                {step.aiRationale && (
                  <div className="mt-2.5 text-[11px] text-mute bg-canvas rounded-xl px-3 py-2 max-w-2xl">
                    <span className="font-semibold">Why {cls ? cls.replace(/-/g, ' ') : 'this'}?</span> {step.aiRationale}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Consolidated systems */}
      <div className="card p-6 print:break-inside-avoid">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Layers size={16} className="text-veil-deep" /> Systems touched by this process
        </h3>
        <div className="flex flex-wrap gap-2 mt-4">
          {systems.length ? (
            systems.map((sys) => (
              <span key={sys} className="chip !py-1.5 !px-3.5 bg-veil-soft border-transparent text-veil-deep">{sys}</span>
            ))
          ) : (
            <span className="text-sm text-faint">No systems tagged yet.</span>
          )}
        </div>
      </div>

      {/* AI Automation & Agentic Deployment Roadmap Section */}
      <div className="card p-6 space-y-4 border-t-2 border-t-citron">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-line">
          <div>
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <Sparkles size={15} className="text-citron-deep animate-pulse" /> AI Deployment Roadmap &amp; Hackathon Pitch
            </h3>
            <p className="text-xs text-mute mt-0.5">
              Draft step-by-step RPA/cognitive pipelines grounded in your registered systems and generate campaign copy for Project Vanguard.
            </p>
          </div>
          {!plan && !loadingPlan && (
            <button
              onClick={generateDeploymentPlan}
              className="btn-dark flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs font-semibold"
            >
              <Cpu size={13} /> Architect Deployment Blueprint
            </button>
          )}
        </div>

        {loadingPlan && (
          <div className="py-8 text-center space-y-4 animate-pulse">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-veil text-ink mb-2">
              <Cpu className="animate-spin text-citron-deep" size={20} />
            </div>
            <p className="text-xs font-medium text-ink">Siloam Vanguard AI is compiling integration routes...</p>
            <div className="max-w-xs mx-auto space-y-1.5">
              <div className="h-1 w-full bg-veil overflow-hidden rounded-full">
                <div className="h-full bg-citron animate-[shimmer_1.5s_infinite]" style={{ width: '60%' }}></div>
              </div>
              <p className="text-[10px] text-faint italic font-normal">Standardizing schemas, configuring validation gates, &amp; writing pitch decks...</p>
            </div>
          </div>
        )}

        {errorPlan && (
          <div className="p-4 bg-bad/10 border border-bad/30 rounded-2xl text-center">
            <p className="text-xs text-bad font-semibold">Failed to build deployment plan</p>
            <p className="text-[11px] text-mute mt-1">{errorPlan}</p>
            <button
              onClick={generateDeploymentPlan}
              className="btn-ghost !py-1.5 !px-3 mt-3 text-xs"
            >
              Retry Architecture Build
            </button>
          </div>
        )}

        {!plan && !loadingPlan && !errorPlan && (
          <div className="bg-canvas-soft border border-line rounded-2xl p-5 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-citron/20 text-citron-deep">
              <Sparkles size={16} />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">Ready to deploy?</h4>
              <p className="text-xs text-mute mt-1.5 leading-relaxed">
                Propose a complete 4-phase step-by-step deployment outline. Our engine maps manual steps to automated loops, calculates the value-cost-benefit metrics, and maps critical tool subscriptions and strategic partnerships.
              </p>
            </div>
            <button
              onClick={generateDeploymentPlan}
              className="btn-dark inline-flex items-center gap-1.5 !py-1.5 !px-4 text-xs font-semibold mt-2"
            >
              <Cpu size={13} /> Propose Deployment Steps
            </button>
          </div>
        )}

        {plan && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner details */}
            <div className="bg-canvas border border-line rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-mute uppercase tracking-widest block">Recommended Framework</span>
                <div className="flex items-center gap-2">
                  <span className={`chip !px-2.5 !py-1 font-mono text-[11px] font-bold ${
                    plan.recommendedSolutionType === 'Agentic AI' 
                      ? 'bg-veil-deep text-white border-transparent' 
                      : plan.recommendedSolutionType === 'RPA / Automation' 
                      ? 'bg-citron text-ink font-semibold border-transparent' 
                      : 'bg-veil text-ink border-transparent'
                  }`}>
                    {plan.recommendedSolutionType}
                  </span>
                  <span className="text-xs text-mute">Solution designed with supervisor override gates</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onSaveProcess && (
                  <button
                    onClick={handleSaveRoadmap}
                    className={`${isRoadmapSaved ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'btn-dark'} flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs font-semibold rounded-full`}
                    title="Save this AI deployment roadmap to the process catalog"
                  >
                    <Save size={12} /> {isRoadmapSaved ? 'Roadmap Saved ✓' : 'Save Roadmap'}
                  </button>
                )}
                <button
                  onClick={generateDeploymentPlan}
                  className="btn-ghost flex items-center gap-1.5 !py-1.5 !px-3 text-xs"
                  title="Re-run architecture proposal"
                >
                  <Sparkles size={12} /> Regenerate Proposal
                </button>
              </div>
            </div>

            {/* ROI / TCO Analysis — replaces the old naive "RPA license vs. raw
                token cost" card with the full Total Cost of Ownership engine
                (see src/lib/roiTcoEngine.ts). */}
            <FinanceRoiTcoPanel proc={proc} onSaveProcess={onSaveProcess} />

            {/* 4-Phase Accordion */}
            <div className="space-y-2.5">
              <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider">
                Phase-by-Phase Roadmap Pipeline
              </h4>
              <div className="space-y-2">
                {plan.deploymentSteps.map((step, idx) => {
                  const isExpanded = expandedPhases.includes(idx);
                  return (
                    <div 
                      key={idx} 
                      className="border border-line rounded-2xl overflow-hidden transition-all duration-200 hover:border-faint print:break-inside-avoid"
                    >
                      <button
                        onClick={() => handleTogglePhase(idx)}
                        className="w-full flex items-center justify-between p-4 bg-canvas-soft/40 hover:bg-canvas-soft transition-colors cursor-pointer text-left print:cursor-default"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink text-white text-[10px] font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="text-[10px] text-faint uppercase font-bold tracking-wider">{step.phase}</span>
                            <h5 className="font-semibold text-xs text-ink mt-0.5 truncate">{step.title}</h5>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-mute shrink-0 print:hidden" /> : <ChevronDown size={14} className="text-mute shrink-0 print:hidden" />}
                      </button>

                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-line space-y-4">
                          <p className="text-xs text-mute leading-relaxed">
                            {step.description}
                          </p>

                          {step.systemsInvolved.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] text-faint uppercase font-semibold">Systems Touched</span>
                              <div className="flex flex-wrap gap-1.5">
                                {step.systemsInvolved.map((sys, sysIdx) => (
                                  <span key={sysIdx} className="chip !text-[10px] bg-veil-soft border-transparent text-veil-deep">
                                    {sys}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <span className="text-[10px] text-faint uppercase font-semibold block">Action Items Checklist</span>
                            <div className="space-y-1.5">
                              {step.actionItems.map((item, itemIdx) => {
                                const checkKey = `${idx}-${itemIdx}`;
                                const isChecked = checkedItems[checkKey];
                                return (
                                  <button
                                    key={itemIdx}
                                    onClick={() => handleToggleCheck(checkKey)}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-canvas-soft/50 text-left transition-colors cursor-pointer"
                                  >
                                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                      isChecked ? 'bg-citron border-transparent text-ink' : 'border-line hover:border-faint'
                                    }`}>
                                      {isChecked && <Check size={11} strokeWidth={3} />}
                                    </span>
                                    <span className={`text-xs leading-relaxed ${isChecked ? 'line-through text-faint' : 'text-inksoft'}`}>
                                      {item}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subscriptions & Partnerships Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tooling & Subscriptions */}
              <div className="bg-canvas border border-line rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-line/60 pb-2.5">
                  <CreditCard size={14} className="text-citron-deep shrink-0" />
                  <div>
                    <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">
                      Additional Tool Subscriptions
                    </h4>
                    <p className="text-[10px] text-faint">
                      Estimated recurring fees matched to deployment Key Activities
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {plan.additionalSubscriptions && plan.additionalSubscriptions.length > 0 ? (
                    plan.additionalSubscriptions.map((sub, sIdx) => {
                      const isGemini = sub.toolName.toLowerCase().includes('gemini');
                      // Gemini API Flash actual expected cost for typical flow is around Rp 80.000 ($5)
                      const costIDR = isGemini ? toIDR(5) : toIDR(sub.monthlyCostUSD);
                      return (
                        <div key={sIdx} className="bg-white border border-line/50 p-3 rounded-xl space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-ink">{sub.toolName}</span>
                            <span className="chip !text-[10px] font-mono bg-veil border-transparent text-ink font-semibold">
                              {formatIDR(costIDR)}/mo
                            </span>
                          </div>
                          <div className="text-[11px] text-mute leading-relaxed">
                            <span className="text-[9px] uppercase tracking-wider text-faint font-bold block mb-0.5">Key Enabled Activity</span>
                            {sub.linkedKeyActivity}
                            {isGemini && (
                              <span className="text-[10px] text-emerald-600 block mt-1 font-medium italic">
                                *Note: Gemini API is billed on micro-usage ($0.075/1M tokens), resulting in extremely low operational costs.
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-faint italic">No additional tooling subscriptions required for this framework.</p>
                  )}
                </div>
              </div>

              {/* Strategic Partnerships */}
              <div className="bg-canvas border border-line rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-line/60 pb-2.5">
                  <HeartHandshake size={14} className="text-veil-deep shrink-0" />
                  <div>
                    <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">
                      Required Strategic Partnerships
                    </h4>
                    <p className="text-[10px] text-faint">
                      Essential collaborations needed to harvest maximum value and compliance
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {plan.strategicPartnerships && plan.strategicPartnerships.length > 0 ? (
                    plan.strategicPartnerships.map((partner, pIdx) => (
                      <div key={pIdx} className="bg-white border border-line/50 p-3 rounded-xl space-y-2 shadow-sm">
                        <div className="flex items-start gap-2">
                          <ShieldCheck size={13} className="text-citron-deep shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold text-ink">{partner.partnerName}</span>
                        </div>
                        <div className="text-[11px] text-mute space-y-1.5 leading-relaxed">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-faint font-bold block">Integration Role</span>
                            {partner.roleDescription}
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-faint font-bold block text-emerald-700">Value Unlocked</span>
                            {partner.benefitsCaptured}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-faint italic">No external or cross-department partnerships required.</p>
                  )}
                </div>
              </div>
            </div>

            {/* VPRS Pack — turns this process + the roadmap above into the
                print-ready procurement/vendor document (see
                src/components/VprsPdfPanel.tsx and api/_lib/vprsPdf.ts). */}
            <VprsPdfPanel proc={proc} plan={plan} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProcessCatalogue({
  processes,
  availableSystems,
  selectedViewProcess,
  onSelectProcess,
  onEditProcess,
  onDeleteProcess,
  currentPersona,
  profileName,
  profileRole,
  onCreateNew,
  onSaveProcess,
}: {
  processes: Process[];
  availableSystems: SystemItem[];
  selectedViewProcess: Process | null;
  onSelectProcess: (proc: Process | null) => void;
  onEditProcess: (proc: Process) => void;
  onDeleteProcess: (id: string) => void;
  currentPersona: Persona;
  profileName: string;
  profileRole?: Persona;
  onCreateNew: () => void;
  onSaveProcess: (proc: Process) => void;
}) {
  const [query, setQuery] = useState('');
  const [subFunction, setSubFunction] = useState('');
  const [status, setStatus] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return processes.filter((p) => {
      if (mineOnly && p.ownerName !== profileName) return false;
      if (subFunction && p.subFunction !== subFunction) return false;
      if (status && p.status !== status) return false;
      if (q) {
        const haystack = `${p.title} ${p.description} ${p.ownerName} ${p.steps.map((s) => s.name).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [processes, query, subFunction, status, mineOnly, profileName]);

  const exportToCSV = () => {
    // Escapes special characters for CSV compatibility
    const escape = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const headers = [
      'Process ID',
      'Title',
      'Description',
      'Line of Work',
      'Status',
      'Owner',
      'Last Updated',
      'Completeness Score (%)',
      'Automation Suitability (%)',
      'Steps Count',
      'Systems Involved',
      'Steps Detail (Name [Classification])'
    ];

    const rows = filtered.map((p) => {
      const systems = Array.from(new Set(p.steps.flatMap((s) => s.systems))).join(', ');
      const stepsDetail = p.steps
        .map((s) => `${s.name} [${s.aiClassification || 'Unclassified'}]`)
        .join('; ');

      return [
        escape(p.id),
        escape(p.title),
        escape(p.description),
        escape(p.subFunction),
        escape(p.status),
        escape(p.ownerName),
        escape(p.lastUpdated),
        escape(p.completenessScore),
        escape(p.automationSuitability),
        escape(p.steps.length),
        escape(systems),
        escape(stepsDetail)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `process_catalog_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (selectedViewProcess) {
    return (
      <ProcessDetail
        proc={selectedViewProcess}
        availableSystems={availableSystems}
        onBack={() => onSelectProcess(null)}
        onEdit={() => onEditProcess(selectedViewProcess)}
        onDelete={() => onDeleteProcess(selectedViewProcess.id)}
        currentPersona={currentPersona}
        profileName={profileName}
        profileRole={profileRole}
        onSaveProcess={onSaveProcess}
      />
    );
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Process catalogue</h2>
          <p className="text-sm text-mute mt-0.5">
            {processes.length} documented process{processes.length === 1 ? '' : 'es'} across the directorate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="bg-white hover:bg-canvas-soft border border-line hover:border-faint text-ink font-semibold flex items-center gap-1.5 !py-2 !px-4 text-xs rounded-full transition-all shadow-sm cursor-pointer"
            title="Export catalog data into a formatted CSV file"
          >
            <Download size={13} /> Export Catalog CSV
          </button>
          {currentPersona !== 'Admin' && (
            <button
              onClick={onCreateNew}
              className="btn-dark flex items-center gap-1.5 !py-2 !px-4 text-xs font-semibold rounded-full cursor-pointer"
            >
              <Plus size={13} /> Capture Process
            </button>
          )}
        </div>
      </div>

      {/* Pill filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className="field !rounded-full !py-2 !pl-9 !pr-4 w-full sm:!w-60 text-sm"
            placeholder="Search title, owner, steps…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="field !rounded-full !py-2 !px-4 max-w-[calc(50%-0.3125rem)] sm:max-w-none sm:!w-auto text-sm cursor-pointer"
          value={subFunction}
          onChange={(e) => setSubFunction(e.target.value)}
        >
          <option value="">All lines of work</option>
          {SUBFUNCTIONS_LIST.map((sf) => (
            <option key={sf} value={sf}>{sf}</option>
          ))}
        </select>
        <select
          className="field !rounded-full !py-2 !px-4 max-w-[calc(50%-0.3125rem)] sm:max-w-none sm:!w-auto text-sm cursor-pointer"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Any status</option>
          {['Draft', 'Submitted', 'Refined', 'Approved'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setMineOnly(!mineOnly)}
          className={`chip !py-2 !px-4 cursor-pointer transition-colors ${mineOnly ? 'bg-ink text-white border-transparent' : 'hover:border-faint'}`}
        >
          Mine only
        </button>
      </div>

      {filtered.length === 0 ? (
        processes.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title="Your catalogue is empty"
            body="Document your first working process — the guided journey takes about ten minutes, and the AI does the heavy lifting."
            action={
              currentPersona !== 'Admin' ? (
                <button onClick={onCreateNew} className="btn-dark mt-2"><Plus size={15} /> Capture your first process</button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            icon={<Search size={22} />}
            title="No matches"
            body="No process matches those filters — try clearing the search or switching line of work."
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((proc) => {
            const systems = Array.from(new Set(proc.steps.flatMap((s) => s.systems)));
            return (
              <button
                key={proc.id}
                onClick={() => onSelectProcess(proc)}
                className="card text-left p-5 flex flex-col gap-3 min-w-0 cursor-pointer transition-all hover:shadow-lift hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusChip status={proc.status} />
                  <span className="text-[11px] text-faint">{timeAgo(proc.lastUpdated)}</span>
                </div>
                <div>
                  <div className="font-display font-semibold leading-snug">{proc.title}</div>
                  <div className="text-xs text-mute mt-1">{proc.subFunction}</div>
                </div>
                <p className="text-xs text-mute leading-relaxed line-clamp-2 flex-1">{proc.description}</p>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={proc.ownerName} size={24} />
                    <span className="text-xs font-medium truncate">{proc.ownerName}</span>
                  </div>
                  <span className="chip !text-[11px] shrink-0">{proc.steps.length} steps</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Meter value={proc.completenessScore} /></div>
                  <span className="text-[11px] font-bold text-mute">{proc.completenessScore}%</span>
                </div>
                {systems.length > 0 && (
                  <div className="text-[11px] text-faint truncate min-w-0 w-full">{systems.join(' · ')}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
