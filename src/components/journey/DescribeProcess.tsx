import { ArrowLeft, Loader2, Mic, MicOff, Sparkles } from 'lucide-react';
import { SubFunction } from '../../types';
import { useSpeech } from '../../lib/useSpeech';
import { SUBFUNCTIONS_LIST } from '../../data/mockData';
import { AutoTextarea } from '../ui';

export default function DescribeProcess({
  title,
  setTitle,
  subFunction,
  setSubFunction,
  narrative,
  setNarrative,
  hasOutputs,
  onBack,
  onMine,
}: {
  title: string;
  setTitle: (v: string) => void;
  subFunction: SubFunction | '';
  setSubFunction: (v: SubFunction | '') => void;
  narrative: string;
  setNarrative: (v: string) => void;
  hasOutputs: boolean;
  onBack: () => void;
  onMine: () => void;
}) {
  const speech = useSpeech((chunk) => setNarrative(narrative ? `${narrative.trimEnd()} ${chunk}` : chunk));
  const canMine = narrative.trim().length >= 30 || hasOutputs;

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Describe how you work</h2>
      <p className="text-sm text-mute mt-1.5 max-w-lg">
        In your own words — type it or just talk. Don&rsquo;t worry about structure; counting, classifying and
        expanding the steps is the agent&rsquo;s job.
      </p>

      <div className="mt-7 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="j-title">Give it a working title <span className="text-faint font-normal">(optional)</span></label>
          <input
            id="j-title"
            className="field"
            placeholder="e.g. Monthly VAT filing"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="j-sf">Line of work <span className="text-faint font-normal">(optional — AI can suggest)</span></label>
          <select
            id="j-sf"
            className="field cursor-pointer"
            value={subFunction}
            onChange={(e) => setSubFunction(e.target.value as SubFunction | '')}
          >
            <option value="">Let the agent suggest…</option>
            {SUBFUNCTIONS_LIST.map((sf) => (
              <option key={sf} value={sf}>{sf}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 relative">
        <label className="label" htmlFor="j-narrative">Your process, in your own words</label>
        <AutoTextarea
          id="j-narrative"
          className="field min-h-52 resize-y !pr-16 leading-relaxed"
          placeholder={'e.g. "Every morning I download the discharged patient billings from KAIROS, check the tariff codes against the BPJS rules, then upload the verified claims to the BPJS e-Claim portal. When payments arrive I reconcile them in Dynamics 365…"'}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
        />
        {speech.supported && (
          <button
            type="button"
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            disabled={speech.loading}
            className={`absolute right-3.5 top-9 w-11 h-11 rounded-full grid place-items-center transition-all cursor-pointer ${
              speech.loading
                ? 'bg-ink/50 text-white cursor-not-allowed'
                : speech.listening
                  ? 'bg-bad text-white animate-pulse-ring'
                  : 'bg-ink text-white hover:scale-105'
            }`}
            aria-label={speech.loading ? 'Requesting microphone...' : speech.listening ? 'Stop dictating' : 'Dictate with your voice'}
            title={speech.loading ? 'Requesting microphone...' : speech.listening ? 'Stop dictating' : 'Dictate with your voice'}
          >
            {speech.loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : speech.listening ? (
              <MicOff size={18} />
            ) : (
              <Mic size={18} />
            )}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={speech.error ? 'text-bad font-medium' : 'text-faint'}>
          {speech.error
            ? speech.error
            : speech.loading
              ? 'Requesting microphone permission...'
              : speech.listening
                ? 'Listening… speak naturally, pause anytime.'
                : speech.supported
                  ? 'Tip: tap the mic and narrate your day — the transcript lands here.'
                  : 'Voice input isn’t supported in this browser — typing works just as well.'}
        </span>
        <span className="text-faint">{narrative.trim().length} chars</span>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button className="btn-ghost !py-2 !px-4 text-xs" onClick={onBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="btn-dark" onClick={onMine} disabled={!canMine} title={canMine ? undefined : 'Describe your process (or upload outputs) first'}>
          <Sparkles size={15} /> Let the agent do its work
        </button>
      </div>
    </div>
  );
}
