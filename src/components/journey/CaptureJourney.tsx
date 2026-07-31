import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AudioLines, BrainCircuit, Check, ListChecks, ScanSearch, Sparkles, UploadCloud } from 'lucide-react';
import UploadOutputs from './UploadOutputs';
import DescribeProcess from './DescribeProcess';
import ReviewSteps from './ReviewSteps';
import Recap, { RecapChoice } from './Recap';
import PRDInterviewChatbot from './PRDInterviewChatbot';
import {
  DraftProcess,
  MiningResult,
  Process,
  ProcessStep,
  SubFunction,
  SystemItem,
  UserProfile,
  WorkingOutput,
} from '../../types';
import { computeCompleteness, stepGaps, uid } from '../../lib/utils';
import { SUBFUNCTIONS_LIST } from '../../data/mockData';

type Stage = 'upload' | 'describe' | 'interview' | 'mining' | 'review' | 'recap';

const STAGE_RAIL: Array<{ id: Stage; label: string; icon: typeof UploadCloud }> = [
  { id: 'upload', label: 'Outputs', icon: UploadCloud },
  { id: 'describe', label: 'Describe', icon: AudioLines },
  { id: 'interview', label: 'Interview', icon: BrainCircuit },
  { id: 'mining', label: 'Mine', icon: Sparkles },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'recap', label: 'Confirm', icon: Check },
];

const DRAFT_KEY = 'bp_journey_draft_v2';

const MINING_MESSAGES = [
  'Reading your description…',
  'Separating the distinct processes…',
  'Counting the steps in each one…',
  'Expanding triggers, actions and results…',
  'Detecting the systems you touch…',
  'Classifying each step for the AI transformation…',
];

interface DraftShape {
  stage: Stage;
  outputs: WorkingOutput[];
  title: string;
  subFunction: SubFunction | '';
  narrative: string;
  processes: DraftProcess[];
  overallSummary: string | null;
}

export default function CaptureJourney({
  profile,
  availableSystems,
  onAddSystem,
  onSaveProcess,
  onFinish,
  onSkipToWorkspace,
}: {
  profile: UserProfile;
  allProcesses: Process[];
  availableSystems: SystemItem[];
  onAddSystem: (name: string) => void;
  onSaveProcess: (process: Process) => void;
  onFinish: (destinationTab: string, processId?: string) => void;
  onSkipToWorkspace: () => void;
}) {
  const draft = useRef<DraftShape | null>(
    (() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        return raw ? (JSON.parse(raw) as DraftShape) : null;
      } catch {
        return null;
      }
    })(),
  ).current;

  const [stage, setStage] = useState<Stage>(draft?.stage === 'mining' ? 'describe' : draft?.stage ?? 'upload');
  const [outputs, setOutputs] = useState<WorkingOutput[]>(draft?.outputs ?? []);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [subFunction, setSubFunction] = useState<SubFunction | ''>(draft?.subFunction ?? '');
  const [narrative, setNarrative] = useState(draft?.narrative ?? '');
  const [processes, setProcesses] = useState<DraftProcess[]>(draft?.processes ?? []);
  const [overallSummary, setOverallSummary] = useState<string | null>(draft?.overallSummary ?? null);
  const [miningError, setMiningError] = useState<string | null>(null);
  const [miningMessage, setMiningMessage] = useState(0);
  const [resumedDraft, setResumedDraft] = useState(Boolean(draft));

  // Autosave the journey draft so an interruption never loses work.
  useEffect(() => {
    const snapshot: DraftShape = { stage, outputs, title, subFunction, narrative, processes, overallSummary };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
  }, [stage, outputs, title, subFunction, narrative, processes, overallSummary]);

  useEffect(() => {
    if (stage !== 'mining') return;
    setMiningMessage(0);
    const interval = setInterval(() => {
      setMiningMessage((m) => Math.min(m + 1, MINING_MESSAGES.length - 1));
    }, 900);
    return () => clearInterval(interval);
  }, [stage]);

  const runMining = async (prdNarrative?: string) => {
    setStage('mining');
    setMiningError(null);
    const startedAt = Date.now();
    try {
      const res = await fetch('/api/ai/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || undefined,
          description: prdNarrative ? `${narrative}\n\n${prdNarrative}` : narrative,
          sourceTexts: outputs.map((o) => `--- ${o.name} ---\n${o.text}`),
          availableSystems: availableSystems.map(s => ({
            name: s.name,
            category: s.category,
            description: s.description || ''
          })),
        }),
      });
      if (!res.ok) throw new Error(`Mining failed (${res.status})`);
      const result = (await res.json()) as MiningResult;

      const mined: DraftProcess[] = (result.processes || []).map((proc) => {
        const steps: ProcessStep[] = (proc.steps || []).map((s, i) => ({
          id: uid('step'),
          order: i + 1,
          name: s.name || `Step ${i + 1}`,
          description: s.description || '',
          inputs: s.inputs || [],
          outputs: s.outputs || [],
          decisionPoints: s.decisionPoints || [],
          systems: s.systems || [],
          handOffs: s.handOffs || [],
          aiClassification: s.aiClassification,
          aiRationale: s.aiRationale,
        }));
        for (const s of steps) for (const sys of s.systems) onAddSystem(sys);

        const sf =
          proc.subFunction && (SUBFUNCTIONS_LIST as string[]).includes(proc.subFunction)
            ? (proc.subFunction as SubFunction)
            : '';

        return {
          id: uid('proc'),
          title: proc.title || 'Untitled process',
          subFunction: sf,
          summary: proc.summary || '',
          steps,
          isShared: false,
          taggedUsers: [],
        };
      });

      // Safety net: never land on an empty review.
      if (mined.length === 0) {
        mined.push({
          id: uid('proc'),
          title: title || 'Untitled process',
          subFunction: '',
          summary: '',
          steps: [],
          isShared: false,
          taggedUsers: [],
        });
      }

      setProcesses(mined);
      setOverallSummary(result.overallSummary || null);

      // Let the mining animation land before revealing the result.
      const minimumWait = 2600 - (Date.now() - startedAt);
      setTimeout(() => setStage('review'), Math.max(0, minimumWait));
    } catch (err: any) {
      console.error(err);
      setMiningError('The understanding agent could not reach the server. Check that the dev server is running, then try again.');
    }
  };

  const buildProcesses = (status: Process['status']): Process[] => {
    const ownerLevel = profile.role === 'L2' || profile.role === 'L3' ? profile.role : 'L4';
    const ownerEmail = profile.email || `${profile.name.toLowerCase().replace(/\s+/g, '.')}@local`;
    const now = new Date().toISOString();
    return processes.map((dp) => {
      const description = (dp.summary || '').trim() || dp.title.trim();
      return {
        id: dp.id,
        title: dp.title.trim(),
        description,
        subFunction: (dp.subFunction || 'Transactional Accounting') as SubFunction,
        ownerName: profile.name,
        ownerEmail,
        ownerLevel,
        status,
        steps: dp.steps,
        lastUpdated: now,
        completenessScore: computeCompleteness({ title: dp.title, description, steps: dp.steps }),
        gaps: dp.steps.flatMap((s) => stepGaps(s).map((g) => `Step ${s.order} "${s.name}" is missing ${g}.`)),
        isShared: dp.isShared,
        taggedUsers: dp.taggedUsers,
        manualRoleOverride: dp.manualRoleOverride,
      };
    });
  };

  const confirmReview = () => {
    for (const p of buildProcesses('Draft')) onSaveProcess(p);
    setStage('recap');
  };

  const handleRecapChoice = (choice: RecapChoice) => {
    const firstId = processes[0]?.id;
    if (choice === 'edit') {
      setStage('review');
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    if (choice === 'analyse' || choice === 'advice') {
      for (const p of buildProcesses('Submitted')) onSaveProcess(p);
      onFinish('refinement', firstId);
    } else {
      onFinish(profile.role === 'L4' ? 'catalogue' : 'dashboard', firstId);
    }
  };

  const currentIndex = STAGE_RAIL.findIndex((s) => s.id === stage);

  return (
    <div className="min-h-full canvas-wash overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Progress rail */}
        <div className="flex items-center justify-between mb-8">
          <div className="glass rounded-full px-4 py-2 flex items-center gap-1 sm:gap-2">
            {STAGE_RAIL.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1 sm:gap-2">
                {i > 0 && <span className={`w-4 sm:w-6 h-px ${i <= currentIndex ? 'bg-ink' : 'bg-line'}`} />}
                <span
                  className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-1 transition-colors ${
                    i === currentIndex ? 'bg-ink text-white' : i < currentIndex ? 'text-citron-deep' : 'text-faint'
                  }`}
                >
                  {i < currentIndex ? <Check size={11} /> : <s.icon size={11} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
          <button onClick={onSkipToWorkspace} className="text-xs font-medium text-mute hover:text-ink transition-colors cursor-pointer whitespace-nowrap ml-3">
            Skip for now →
          </button>
        </div>

        {resumedDraft && stage !== 'recap' && (
          <div className="chip bg-citron-soft border-transparent text-citron-deep mb-4 animate-fade-up">
            <Sparkles size={11} /> Resumed your unfinished draft — nothing was lost.
            <button className="cursor-pointer underline decoration-dotted" onClick={() => setResumedDraft(false)}>ok</button>
          </div>
        )}

        {stage === 'upload' && <UploadOutputs outputs={outputs} setOutputs={setOutputs} onNext={() => setStage('describe')} />}

        {stage === 'describe' && (
          <DescribeProcess
            title={title}
            setTitle={setTitle}
            subFunction={subFunction}
            setSubFunction={setSubFunction}
            narrative={narrative}
            setNarrative={setNarrative}
            hasOutputs={outputs.length > 0}
            onBack={() => setStage('upload')}
            onMine={() => setStage('interview')}
          />
        )}

        {stage === 'interview' && (
          <PRDInterviewChatbot
            processTitle={title || 'Untitled Process'}
            onConfirmPRD={(prdText) => {
              runMining(prdText);
            }}
            onBack={() => setStage('describe')}
          />
        )}

        {stage === 'mining' && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
            {!miningError ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-full bg-veil grid place-items-center shadow-lift"
                >
                  <ScanSearch size={36} className="text-ink" />
                </motion.div>
                <h2 className="font-display text-2xl font-semibold tracking-tight mt-8">Understanding agent at work</h2>
                <motion.p key={miningMessage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-mute mt-2">
                  {MINING_MESSAGES[miningMessage]}
                </motion.p>
                <div className="mt-8 w-56">
                  <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <motion.div
                      className="h-full bg-citron rounded-full"
                      initial={{ width: '8%' }}
                      animate={{ width: '92%' }}
                      transition={{ duration: 3.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-blush grid place-items-center text-warn">
                  <ScanSearch size={26} />
                </div>
                <h2 className="font-display text-xl font-semibold tracking-tight mt-6">That didn&rsquo;t go through</h2>
                <p className="text-sm text-mute mt-2 max-w-sm">{miningError}</p>
                <div className="flex gap-2 mt-6">
                  <button className="btn-ghost !py-2 !px-4 text-xs" onClick={() => setStage('describe')}>Back</button>
                  <button className="btn-dark !py-2 !px-4 text-xs" onClick={() => runMining()}>Try again</button>
                </div>
              </>
            )}
          </div>
        )}

        {stage === 'review' && (
          <ReviewSteps
            processes={processes}
            setProcesses={setProcesses}
            overallSummary={overallSummary}
            availableSystems={availableSystems}
            onAddSystem={onAddSystem}
            onBack={() => setStage('describe')}
            onConfirm={confirmReview}
          />
        )}

        {stage === 'recap' && <Recap processes={processes} onChoose={handleRecapChoice} />}
      </div>
    </div>
  );
}
