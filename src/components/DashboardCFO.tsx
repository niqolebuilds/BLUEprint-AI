import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ArrowUpRight, Award, Route, TrendingUp } from 'lucide-react';
import { ImprovementItem, ManagedProject, Persona, Process, ProjectStage } from '../types';
import { SUBFUNCTIONS_LIST } from '../data/mockData';
import { CHART_COLORS, classificationCounts, CLASSIFICATION_META, timeAgo } from '../lib/utils';
import { Avatar, Meter, Stat, StatusChip } from './ui';

const TOOLTIP_STYLE = {
  borderRadius: 14,
  border: '1px solid var(--color-line)',
  background: '#fff',
  boxShadow: 'var(--shadow-lift)',
  fontSize: 12,
  padding: '8px 12px',
};

/** Executive dashboard — directorate coverage, classification mix, champions, transformation plan (US-13/14/15/16). */
export default function DashboardCFO({
  processes,
  currentPersona,
  improvementItems,
  managedProjects = [],
  onSelectProcess,
  onUpdateProject,
  onNavigateToProject,
}: {
  processes: Process[];
  currentPersona: Persona;
  improvementItems: ImprovementItem[];
  managedProjects?: ManagedProject[];
  onSelectProcess: (proc: Process) => void;
  onUpdateProject?: (proj: ManagedProject) => void;
  onNavigateToProject?: () => void;
}) {
  const coverageData = useMemo(
    () =>
      SUBFUNCTIONS_LIST.map((sf) => ({
        name: sf
          .replace(/\s*\(.*?\)/, '')
          .split(' & ')[0]!
          .split(' ')
          .slice(0, 2)
          .join('\u00A0'),
        full: sf,
        processes: processes.filter((p) => p.subFunction === sf).length,
      })),
    [processes],
  );

  const counts = classificationCounts(processes);
  const classData = (['automation', 'agentic-ai', 'human-in-the-loop'] as const)
    .map((cls) => ({ id: cls, name: CLASSIFICATION_META[cls].label, value: counts[cls] }))
    .filter((d) => d.value > 0);
  const totalClassified = classData.reduce((s, d) => s + d.value, 0);

  const champions = useMemo(() => {
    const byOwner = new Map<string, { count: number; completeness: number }>();
    for (const p of processes) {
      const entry = byOwner.get(p.ownerName) ?? { count: 0, completeness: 0 };
      entry.count += 1;
      entry.completeness += p.completenessScore;
      byOwner.set(p.ownerName, entry);
    }
    return Array.from(byOwner.entries())
      .map(([name, v]) => ({ name, count: v.count, avg: Math.round(v.completeness / v.count) }))
      .sort((a, b) => b.count - a.count || b.avg - a.avg)
      .slice(0, 4);
  }, [processes]);

  const automationCandidates = processes.filter((p) => (p.automationSuitability ?? 0) >= 70).length;
  const avgCompleteness = processes.length
    ? Math.round(processes.reduce((s, p) => s + p.completenessScore, 0) / processes.length)
    : 0;
  const resolvedImprovements = improvementItems.filter((i) => i.status === 'Resolved').length;

  const recent = [...processes]
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 5);

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {currentPersona === 'L1' ? 'Directorate overview' : 'Subfunction overview'}
        </h2>
        <span className="text-xs text-faint">Last refreshed {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* Stat tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 print:break-inside-avoid">
        <Stat label="Processes documented" value={processes.length} hint="across 7 functions" accent="citron" />
        <Stat label="Avg. completeness" value={`${avgCompleteness}%`} hint="of required detail captured" />
        <Stat label="Automation candidates" value={automationCandidates} hint="suitability ≥ 70" accent="veil" />
        <Stat label="Improvements resolved" value={`${resolvedImprovements}/${improvementItems.length}`} hint="tracked initiatives" />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Coverage by subfunction */}
        <div className="card p-6 lg:col-span-3 print:break-inside-avoid">
          <h3 className="font-display font-semibold text-sm">Documentation coverage by line of work</h3>
          <p className="text-xs text-mute mt-0.5 mb-4">Documented processes per subfunction</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={coverageData} margin={{ top: 4, right: 4, bottom: 45, left: -28 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9.5, fill: 'var(--color-mute)' }}
                axisLine={{ stroke: 'var(--color-line)' }}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={65}
              />
              <YAxis tick={{ fontSize: 10.5, fill: 'var(--color-mute)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(23,23,28,0.04)' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: any) => [`${value} process${value === 1 ? '' : 'es'}`, 'Documented']}
                labelFormatter={(_, payload) => (payload?.[0]?.payload as any)?.full ?? ''}
              />
              <Bar dataKey="processes" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Classification mix */}
        <div className="card p-6 lg:col-span-2 print:break-inside-avoid">
          <h3 className="font-display font-semibold text-sm">How the work splits</h3>
          <p className="text-xs text-mute mt-0.5 mb-1">{totalClassified} classified steps</p>
          {totalClassified === 0 ? (
            <div className="h-52 grid place-items-center text-sm text-faint text-center px-6">
              Run AI refinement on a process to see the agentic / automation / human split.
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="55%" height={190}>
                <PieChart>
                  <Pie data={classData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3} strokeWidth={2} stroke="#fff">
                    {classData.map((d) => (
                      <Cell key={d.id} fill={CHART_COLORS[d.id]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => [`${value} steps`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2.5 flex-1">
                {classData.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[d.id] }} />
                    <span className="text-inksoft font-medium flex-1">{CLASSIFICATION_META[d.id].short}</span>
                    <span className="font-bold">{Math.round((d.value / totalClassified) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Recent processes */}
          <div className="card p-6 lg:col-span-3 print:break-inside-avoid">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <TrendingUp size={15} className="text-veil-deep" /> Latest documentation activity
            </h3>
            <ul className="mt-4 divide-y divide-line">
              {recent.map((proc) => (
                <li key={proc.id}>
                  <button
                    onClick={() => onSelectProcess(proc)}
                    className="w-full text-left py-3 flex items-center gap-3 group cursor-pointer print:cursor-default"
                  >
                    <Avatar name={proc.ownerName} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-veil-deep transition-colors">{proc.title}</div>
                      <div className="text-[11px] text-faint">{proc.ownerName} · {timeAgo(proc.lastUpdated)}</div>
                    </div>
                    <StatusChip status={proc.status} />
                    <ArrowUpRight size={14} className="text-faint group-hover:text-ink transition-colors shrink-0 print:hidden" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Champions */}
          <div className="card p-6 lg:col-span-2 print:break-inside-avoid">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <Award size={15} className="text-citron-deep" /> Directorate champions
            </h3>
            <ul className="mt-3.5 space-y-3">
              {champions.map((champ, i) => (
                <li key={champ.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-faint w-4">{i + 1}</span>
                  <Avatar name={champ.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{champ.name}</div>
                    <div className="text-[11px] text-faint">{champ.count} processes · {champ.avg}% avg detail</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Transformation plan */}
        <div className="card bg-ink border-transparent p-6 text-white print:break-inside-avoid space-y-4">
          <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                <Route size={15} className="text-citron" /> Native-AI transformation
              </h3>
              {onNavigateToProject && (
                <button
                  onClick={onNavigateToProject}
                  className="text-[11px] font-semibold text-citron hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Manage <ArrowRight size={12} />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {managedProjects.length > 0 ? (
                managedProjects.slice(0, 4).map((proj) => (
                  <div key={proj.id} className="p-4 rounded-xl bg-white/10 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold truncate text-white/90">{proj.title}</span>
                      <select
                        value={proj.stage}
                        onChange={(e) =>
                          onUpdateProject?.({
                            ...proj,
                            stage: e.target.value as ProjectStage,
                          })
                        }
                        className="bg-black/50 text-[10px] font-bold text-citron border border-white/20 rounded px-1.5 py-0.5 cursor-pointer hover:border-citron transition-colors"
                      >
                        <option value="4: Locked Project" className="bg-ink text-white">4: Locked</option>
                        <option value="5: Tracked Execution" className="bg-ink text-white">5: Executing</option>
                        <option value="6: Realised Benefit" className="bg-ink text-white">6: Realised</option>
                      </select>
                    </div>

                    <div className="text-[10px] text-white/70 space-y-1.5 bg-black/20 p-2.5 rounded-lg">
                      <div className="flex justify-between items-center border-b border-white/10 pb-1.5 mb-1.5">
                        <span>Project Contact:</span>
                        <a href={`mailto:${proj.ownerEmail}`} className="text-white hover:text-citron transition-colors font-medium flex items-center gap-1">
                          {proj.ownerName}
                        </a>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Time / Effort:</span>
                        <span className="text-white font-medium">Est. 40% reduction</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Financial Impact:</span>
                        <span className="text-emerald-400 font-medium">IDR 25.000.000 / yr</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-white/60">
                        <span>{proj.stage.split(':')[1]?.trim()}</span>
                        <span className="font-bold text-white/90">{proj.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-citron h-full rounded-full transition-all duration-300"
                          style={{ width: `${proj.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                improvementItems.slice(0, 3).map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-white/85">{item.processTitle}</span>
                      <span className={`chip border-transparent !text-[10px] ${item.status === 'Resolved' ? 'bg-citron text-ink' : item.status === 'In Progress' ? 'bg-veil text-ink' : 'bg-white/15 text-white'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Meter value={item.status === 'Resolved' ? 100 : item.status === 'In Progress' ? 55 : 15} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="text-[11px] text-white/50 pt-2 border-t border-white/10">
              Stages 4–6 · Connected directly to active Locked Projects &amp; execution tracker.
            </p>
          </div>
        </div>
      </div>
  );
}
