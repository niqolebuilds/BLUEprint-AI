import { motion } from 'motion/react';
import { ChartNoAxesColumn, Check, Lightbulb, PencilLine, ScanSearch } from 'lucide-react';
import { DraftProcess } from '../../types';
import { classificationCounts, CLASSIFICATION_META, computeCompleteness } from '../../lib/utils';
import { Meter } from '../ui';

export type RecapChoice = 'edit' | 'analyse' | 'results' | 'advice';

const CHOICES: Array<{ id: RecapChoice; icon: typeof PencilLine; title: string; body: string }> = [
  { id: 'edit', icon: PencilLine, title: 'Edit them', body: 'Go back and adjust processes, steps or details.' },
  { id: 'analyse', icon: ScanSearch, title: 'Analyse them', body: 'Run the full AI refinement & classification.' },
  { id: 'results', icon: ChartNoAxesColumn, title: 'See the results', body: 'Open your dashboard and catalogue.' },
  { id: 'advice', icon: Lightbulb, title: 'Get improvement advice', body: 'Where automation or agentic AI helps most.' },
];

export default function Recap({
  processes,
  onChoose,
}: {
  processes: DraftProcess[];
  onChoose: (choice: RecapChoice) => void;
}) {
  const counts = classificationCounts(processes.map((p) => ({ steps: p.steps } as any)));
  const totalSteps = processes.reduce((n, p) => n + p.steps.length, 0);

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="w-10 h-10 rounded-full bg-citron grid place-items-center shrink-0"
        >
          <Check size={18} className="text-ink" />
        </motion.span>
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Captured &amp; saved</h2>
          <p className="text-sm text-mute mt-0.5">
            {processes.length} process{processes.length === 1 ? '' : 'es'} · {totalSteps} step{totalSteps === 1 ? '' : 's'} — what would you like to do next?
          </p>
        </div>
      </div>

      {/* Per-process recap */}
      <div className="mt-6 space-y-3">
        {processes.map((p) => {
          const completeness = computeCompleteness({ title: p.title, description: p.summary || p.title, steps: p.steps });
          const pc = classificationCounts([{ steps: p.steps } as any]);
          return (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold leading-snug">{p.title || 'Untitled process'}</div>
                  <div className="text-xs text-mute mt-1">{p.subFunction || 'Line of work not set'}</div>
                </div>
                <span className="chip bg-canvas border-transparent">{p.steps.length} steps</span>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="label">Completeness</div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1"><Meter value={completeness} /></div>
                    <span className="text-sm font-bold">{completeness}%</span>
                  </div>
                </div>
                <div>
                  <div className="label">Work profile</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['automation', 'agentic-ai', 'human-in-the-loop'] as const).map((cls) =>
                      pc[cls] > 0 ? (
                        <span key={cls} className={`chip border-transparent ${CLASSIFICATION_META[cls].bg} ${CLASSIFICATION_META[cls].fg}`}>
                          {pc[cls]} × {CLASSIFICATION_META[cls].short}
                        </span>
                      ) : null,
                    )}
                    {pc.unclassified > 0 && <span className="chip">{pc.unclassified} unclassified</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {processes.length > 1 && (
        <div className="mt-3 text-xs text-mute text-center">
          Across all processes:{' '}
          {(['automation', 'agentic-ai', 'human-in-the-loop'] as const)
            .filter((cls) => counts[cls] > 0)
            .map((cls) => `${counts[cls]} ${CLASSIFICATION_META[cls].short.toLowerCase()}`)
            .join(' · ')}
        </div>
      )}

      {/* Choice cards */}
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        {CHOICES.map((choice, i) => (
          <motion.button
            key={choice.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07 }}
            onClick={() => onChoose(choice.id)}
            className={`card text-left p-5 flex items-start gap-4 cursor-pointer transition-all hover:shadow-lift hover:-translate-y-0.5 ${
              choice.id === 'analyse' ? 'bg-ink border-transparent text-white' : ''
            }`}
          >
            <span
              className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${
                choice.id === 'analyse' ? 'bg-citron text-ink' : 'bg-veil-soft text-veil-deep'
              }`}
            >
              <choice.icon size={17} />
            </span>
            <span>
              <span className="font-semibold text-sm block">{choice.title}</span>
              <span className={`text-xs mt-0.5 block ${choice.id === 'analyse' ? 'text-white/60' : 'text-mute'}`}>{choice.body}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
