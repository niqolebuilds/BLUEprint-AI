import { useState } from 'react';
import { FileCheck2, Loader2, Download, AlertTriangle, Eye, EyeOff, FileText, FileCode2 } from 'lucide-react';
import { Process, DeploymentPlan } from '../types';

interface VprsPdfResult {
  pdfBase64: string;
  html: string;
  markdown: string;
  manifest: { key: string; title: string; status: string; reason: string }[];
  profile: string;
}

function downloadBlob(content: string | Uint8Array, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * "Generate VPRS Pack" — turns this process and its AI Deployment Roadmap
 * into a print-ready Vendor Production Requirement Specification (the
 * document that goes to procurement and the vendor). Renders server-side via
 * /api/vprs-pdf, which wraps the vendored vprs-pdf/ package — see
 * api/_lib/vprsPdf.ts for the Process → spec mapping and the Chromium
 * pairing this depends on.
 */
export default function VprsPdfPanel({ proc, plan }: { proc: Process; plan: DeploymentPlan }) {
  const [profile, setProfile] = useState<'full' | 'brief'>('full');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VprsPdfResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fileStem = proc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'vprs-pack';

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError('');
    setResult(null);
    try {
      console.log('[VprsPdfPanel] generate request', { procId: proc.id, profile });
      const res = await fetch('/api/vprs-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proc, plan, profile }),
      });
      const json = await res.json();
      console.log('[VprsPdfPanel] generate response', { ok: json.ok, status: res.status, sections: json.data?.manifest?.length });
      if (!res.ok || !json.ok) throw new Error(json.error || `Request failed (HTTP ${res.status}).`);
      setResult(json.data as VprsPdfResult);
    } catch (err) {
      console.error('[VprsPdfPanel] generate failed', err);
      setError(err instanceof Error ? err.message : 'Failed to generate the VPRS pack.');
    } finally {
      setIsGenerating(false);
    }
  };

  const suffix = profile === 'brief' ? '-brief' : '';

  return (
    <div className="bg-white border border-line rounded-2xl p-4 space-y-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <FileCheck2 size={14} className="text-citron-deep" />
          <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider">Generate VPRS Pack</h4>
        </div>
        <select
          value={profile}
          onChange={(e) => {
            setProfile(e.target.value as 'full' | 'brief');
            setResult(null);
          }}
          className="field !py-1.5 !px-2.5 text-xs w-auto cursor-pointer"
        >
          <option value="full">Full — contract annex (~26 pp)</option>
          <option value="brief">Brief — quotation pack (~13 pp)</option>
        </select>
      </div>

      <p className="text-[11px] text-mute leading-relaxed">
        Turns this process and its AI Deployment Roadmap above into a print-ready{' '}
        <strong className="text-inksoft">Vendor Production Requirement Specification</strong> — the document that goes to
        procurement and the vendor. Rendered server-side; unknown technical specifics (integration protocol, frequency) are
        flagged for vendor confirmation rather than guessed.
      </p>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="btn-dark flex items-center gap-1.5 !py-2 !px-4 text-xs font-semibold cursor-pointer disabled:opacity-60"
      >
        {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <FileCheck2 size={13} />}
        {isGenerating ? 'Generating… (Chromium is rendering diagrams and paginating)' : 'Generate VPRS Pack'}
      </button>

      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3 pt-1 border-t border-line/60">
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2.5">
            <span className="text-[11px] text-emerald-700 font-semibold">
              Pack ready — {result.manifest.filter((m) => m.status === 'RENDERED').length} of {result.manifest.length} sections
              hydrated.
            </span>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-ghost flex items-center gap-1.5 !py-1 !px-2.5 text-[11px] cursor-pointer"
            >
              {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPreview ? 'Hide preview' : 'Preview HTML'}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => downloadBlob(base64ToBytes(result.pdfBase64), 'application/pdf', `${fileStem}${suffix}.pdf`)}
              className="btn-dark flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs font-semibold cursor-pointer"
            >
              <Download size={12} /> PDF
            </button>
            <button
              onClick={() => downloadBlob(result.markdown, 'text/markdown;charset=utf-8', `${fileStem}${suffix}.md`)}
              className="btn-outline flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs font-semibold cursor-pointer"
            >
              <FileText size={12} /> Markdown
            </button>
            <button
              onClick={() => downloadBlob(result.html, 'text/html;charset=utf-8', `${fileStem}${suffix}.html`)}
              className="btn-outline flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs font-semibold cursor-pointer"
            >
              <FileCode2 size={12} /> HTML
            </button>
          </div>

          {showPreview && (
            <iframe
              title={`VPRS pack preview — ${proc.title}`}
              srcDoc={result.html}
              sandbox=""
              className="w-full h-[70vh] rounded-xl border border-line bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}
