import { useState } from 'react';
import { BellRing, CircleCheck, Flame, Lightbulb, Plus } from 'lucide-react';
import { ImprovementItem, Process } from '../types';
import { MOCK_USERS } from '../data/mockData';
import { CLASSIFICATION_META, uid } from '../lib/utils';
import { Avatar, Meter, Stat } from './ui';

const STATUS_FLOW: ImprovementItem['status'][] = ['Identified', 'In Progress', 'Resolved'];

/** Manager space (L3) — completion tracking, high-effort flags, improvement guidance (US-17/19/20). */
export default function DashboardManager({
  processes,
  improvementItems,
  onAddImprovementItem,
  onUpdateImprovementItem,
  onTriggerReminder,
}: {
  processes: Process[];
  improvementItems: ImprovementItem[];
  onAddImprovementItem: (item: ImprovementItem) => void;
  onUpdateImprovementItem: (item: ImprovementItem) => void;
  onTriggerReminder: (email: string, subject: string, msg: string) => void;
}) {
  const [remindedEmails, setRemindedEmails] = useState<string[]>([]);

  const roster = MOCK_USERS.filter((u) => u.level === 'L4').map((user) => {
    const owned = processes.filter((p) => p.ownerEmail === user.email || p.ownerName === user.name);
    const status: 'Complete' | 'In progress' | 'Not started' =
      owned.length === 0 ? 'Not started' : owned.every((p) => p.completenessScore >= 85) ? 'Complete' : 'In progress';
    return { user, owned, status };
  });

  const completionPct = roster.length
    ? Math.round((roster.filter((r) => r.status === 'Complete').length / roster.length) * 100)
    : 0;

  const highEffort = processes
    .filter((p) => (p.effortRating ?? 0) >= 4 || (p.automationSuitability ?? 0) >= 70)
    .sort((a, b) => (b.automationSuitability ?? 0) - (a.automationSuitability ?? 0))
    .slice(0, 4);

  const tracked = new Set(improvementItems.map((i) => i.processId));

  const acceptRecommendation = (proc: Process) => {
    const solution: ImprovementItem['recommendedSolution'] =
      (proc.automationSuitability ?? 0) >= 80 ? 'Automation' : (proc.effortRating ?? 0) >= 4 ? 'Agentic AI' : 'Simplification';
    onAddImprovementItem({
      id: uid('imp'),
      processId: proc.id,
      processTitle: proc.title,
      subFunction: proc.subFunction,
      recommendedSolution: solution,
      status: 'Identified',
      ownerName: proc.ownerName,
      expectedImpact: `Reduce manual effort in "${proc.title}" via ${solution.toLowerCase()} — drivers: volume ${proc.volumeRating ?? '?'}/5, repetitiveness ${proc.repetitivenessRating ?? '?'}/5.`,
    });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">Team space</h2>

      <div className="grid sm:grid-cols-3 gap-4 print:break-inside-avoid">
        <Stat label="Team completion" value={`${completionPct}%`} hint="of personnel fully documented" accent="citron" />
        <Stat label="High-effort workflows" value={highEffort.length} hint="flagged for improvement" accent="veil" />
        <Stat label="Guidance items" value={improvementItems.filter((i) => i.status !== 'Resolved').length} hint="open vs resolved tracked below" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Personnel completion tracker */}
        <div className="card p-6 print:break-inside-avoid">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <CircleCheck size={15} className="text-citron-deep" /> Personnel documentation tracker
          </h3>
          <ul className="mt-4 space-y-3.5">
            {roster.map(({ user, owned, status }) => (
              <li key={user.id} className="flex items-center gap-3">
                <Avatar name={user.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user.name}</div>
                  <div className="text-[11px] text-faint truncate">{user.subFunction} · {owned.length} process{owned.length === 1 ? '' : 'es'}</div>
                </div>
                <span
                  className={`chip border-transparent ${
                    status === 'Complete' ? 'bg-citron-soft text-citron-deep' : status === 'In progress' ? 'bg-veil-soft text-veil-deep' : 'bg-blush/60 text-warn'
                  }`}
                >
                  {status}
                </span>
                {status !== 'Complete' && (
                  <button
                    className="btn-ghost !p-2 shrink-0 disabled:opacity-40 print:hidden"
                    title={remindedEmails.includes(user.email) ? 'Reminder sent' : 'Send a reminder'}
                    aria-label={`Remind ${user.name}`}
                    disabled={remindedEmails.includes(user.email)}
                    onClick={() => {
                      onTriggerReminder(
                        user.email,
                        'Reminder: complete your process documentation',
                        `Hi ${user.name.split(' ')[0]}, your documentation is ${status === 'Not started' ? 'not started yet' : 'still missing detail'} — please complete it so the team analysis can run.`,
                      );
                      setRemindedEmails((prev) => [...prev, user.email]);
                    }}
                  >
                    <BellRing size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* High-effort flags */}
        <div className="card p-6 print:break-inside-avoid">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <Flame size={15} className="text-warn" /> High-effort workflows
          </h3>
          <p className="text-xs text-mute mt-0.5">Flagged by effort and automation suitability — accept a recommendation to track it.</p>
          <ul className="mt-4 space-y-3">
            {highEffort.length === 0 && (
              <li className="text-sm text-faint py-6 text-center">Nothing flagged yet — run AI refinement on your team&rsquo;s processes.</li>
            )}
            {highEffort.map((proc) => (
              <li key={proc.id} className="rounded-2xl border border-line p-4 print:break-inside-avoid">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{proc.title}</div>
                    <div className="text-[11px] text-faint mt-0.5">{proc.ownerName} · effort {proc.effortRating ?? '—'}/5</div>
                  </div>
                  {proc.automationSuitability != null && (
                    <span className="chip bg-veil-soft border-transparent text-veil-deep shrink-0">{proc.automationSuitability} suitability</span>
                  )}
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-mute">
                    Recommended: <strong>{(proc.automationSuitability ?? 0) >= 80 ? 'Automation' : 'Agentic AI'}</strong>
                  </span>
                  {tracked.has(proc.id) ? (
                    <span className="text-[11px] font-semibold text-ok">Tracked ✓</span>
                  ) : (
                    <button className="btn-ghost !py-1.5 !px-3 !text-[11px] print:hidden" onClick={() => acceptRecommendation(proc)}>
                      <Plus size={11} /> Track improvement
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Improvement / guidance tracker */}
      <div className="card p-6 print:break-inside-avoid">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Lightbulb size={15} className="text-veil-deep" /> Improvement &amp; guidance tracker
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] text-mute">
                <th className="pb-2.5 font-semibold">Process</th>
                <th className="pb-2.5 font-semibold">Solution</th>
                <th className="pb-2.5 font-semibold">Owner</th>
                <th className="pb-2.5 font-semibold w-44">Expected impact</th>
                <th className="pb-2.5 font-semibold">Status</th>
                <th className="pb-2.5 font-semibold">Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {improvementItems.map((item) => {
                const solutionTone =
                  item.recommendedSolution === 'Agentic AI' ? CLASSIFICATION_META['agentic-ai'] : item.recommendedSolution === 'Automation' ? CLASSIFICATION_META.automation : null;
                return (
                  <tr key={item.id}>
                    <td className="py-3 pr-3 font-medium max-w-56"><span className="line-clamp-1">{item.processTitle}</span></td>
                    <td className="py-3 pr-3">
                      <span className={`chip border-transparent ${solutionTone ? `${solutionTone.bg} ${solutionTone.fg}` : 'bg-canvas'}`}>
                        {item.recommendedSolution}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-mute whitespace-nowrap">{item.ownerName}</td>
                    <td className="py-3 pr-3 text-xs text-mute max-w-64"><span className="line-clamp-2">{item.expectedImpact}</span></td>
                    <td className="py-3 pr-3">
                      <select
                        className="field !py-1.5 !px-3 !text-xs !rounded-full !w-auto cursor-pointer"
                        value={item.status}
                        onChange={(e) => onUpdateImprovementItem({ ...item, status: e.target.value as ImprovementItem['status'] })}
                      >
                        {STATUS_FLOW.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 text-xs text-mute whitespace-nowrap">{item.realizedSavings ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <Meter value={improvementItems.length ? (improvementItems.filter((i) => i.status === 'Resolved').length / improvementItems.length) * 100 : 0} />
          </div>
          <span className="text-xs text-mute font-semibold whitespace-nowrap">
            {improvementItems.filter((i) => i.status === 'Resolved').length} of {improvementItems.length} resolved
          </span>
        </div>
      </div>
    </div>
  );
}
