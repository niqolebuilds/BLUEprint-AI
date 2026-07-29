import { useRef, useState } from 'react';
import { ArrowRight, CloudUpload, FileText, Plus, X } from 'lucide-react';
import { WorkingOutput } from '../../types';
import { uid } from '../../lib/utils';
import { AutoTextarea } from '../ui';

const ACCEPTED = ['.txt', '.md', '.csv', '.json', '.log'];

export default function UploadOutputs({
  outputs,
  setOutputs,
  onNext,
}: {
  outputs: WorkingOutput[];
  setOutputs: (outputs: WorkingOutput[]) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [rejected, setRejected] = useState<string | null>(null);

  const addFiles = async (files: FileList | File[]) => {
    const next: WorkingOutput[] = [];
    let skipped: string | null = null;
    for (const file of Array.from(files)) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (!ACCEPTED.includes(ext) || file.size > 1_000_000) {
        skipped = file.name;
        continue;
      }
      const text = await file.text();
      next.push({ id: uid('out'), name: file.name, kind: 'file', text });
    }
    setRejected(skipped);
    if (next.length) setOutputs([...outputs, ...next]);
  };

  const addPasted = () => {
    if (!pasteText.trim()) return;
    setOutputs([
      ...outputs,
      { id: uid('out'), name: `Pasted notes ${outputs.filter((o) => o.kind === 'pasted').length + 1}`, kind: 'pasted', text: pasteText.trim() },
    ]);
    setPasteText('');
    setPasteOpen(false);
  };

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Upload your working outputs</h2>
      <p className="text-sm text-mute mt-1.5 max-w-lg">
        Reports, checklists, handover notes, exported logs — anything you produce while working. The
        understanding agent reads them to reconstruct your process. This step is optional.
      </p>

      <div
        className={`mt-7 rounded-card border-2 border-dashed px-8 py-12 text-center transition-all cursor-pointer bg-card/60 ${
          dragging ? 'border-veil-deep bg-veil-soft/60' : 'border-line hover:border-faint'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        role="button"
        aria-label="Upload working output files"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-veil-soft grid place-items-center text-veil-deep shadow-soft">
          <CloudUpload size={26} />
        </div>
        <div className="font-semibold mt-4">Drop your files here</div>
        <div className="text-xs text-mute mt-1.5">
          Plain text works best — {ACCEPTED.join(', ')} up to 1&nbsp;MB each
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {rejected && (
        <div className="text-xs text-warn mt-2">
          Skipped “{rejected}” — only small plain-text formats can be mined here.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {outputs.map((output) => (
          <span key={output.id} className="chip !py-1.5 !px-3">
            <FileText size={12} className="text-veil-deep" />
            {output.name}
            <span className="text-faint font-normal">{Math.max(1, Math.round(output.text.length / 1000))}k chars</span>
            <button
              onClick={() => setOutputs(outputs.filter((o) => o.id !== output.id))}
              className="text-faint hover:text-bad cursor-pointer"
              aria-label={`Remove ${output.name}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <button onClick={() => setPasteOpen(!pasteOpen)} className="chip !py-1.5 !px-3 hover:border-faint cursor-pointer">
          <Plus size={12} /> Paste text instead
        </button>
      </div>

      {pasteOpen && (
        <div className="mt-3 animate-fade-up">
          <AutoTextarea
            autoFocus
            className="field min-h-28 resize-y"
            placeholder="Paste an excerpt of a report, checklist or handover note…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button className="btn-ghost !py-1.5 !px-4 text-xs" onClick={addPasted} disabled={!pasteText.trim()}>
              Add to working outputs
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button onClick={onNext} className="text-xs font-medium text-mute hover:text-ink transition-colors cursor-pointer">
          Nothing to upload — skip
        </button>
        <button className="btn-dark" onClick={onNext}>
          {outputs.length > 0 ? `Continue with ${outputs.length} document${outputs.length === 1 ? '' : 's'}` : 'Continue'}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
