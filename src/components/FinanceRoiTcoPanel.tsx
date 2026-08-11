import { ReactNode, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Info,
  Save,
  Download,
  Bot,
  Cpu,
  Combine,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Process } from '../types';
import { formatIDR, formatIDRCompact } from '../lib/utils';
import {
  FINANCE_PROCESS_TEMPLATES,
  FinanceProcessTemplate,
  suggestTemplateForSubFunction,
} from '../data/financeProcessTemplates';
import { PRICING_STANDARDS, DEFAULT_FX_IDR_PER_USD } from '../data/pricingStandards';
import { buildDefaultConfig, BuildConfigOptions } from '../lib/roiTcoDefaults';
import { runRoiTcoEngine, estimateMonthlyVolumeFromRating, OptionSummary, ScenarioName } from '../lib/roiTcoEngine';

type Overrides = NonNullable<BuildConfigOptions['overrides']>;

/** Everything this panel needs to fully reproduce a run — persisted on Process.savedRoiTco. */
export interface SavedRoiTcoState {
  templateKey: string;
  docsPerMonth: number;
  oldProcessMonthlyCostIDR: number;
  useProModel: boolean;
  horizonMonths: number;
  discountRateAnnualPct: number;
  fxIdrPerUsd: number;
  overrides: Overrides;
}

const TOOLTIP_STYLE = {
  borderRadius: 14,
  border: '1px solid var(--color-line)',
  background: '#fff',
  boxShadow: 'var(--shadow-lift)',
  fontSize: 12,
  padding: '8px 12px',
};

const SCENARIO_COLOR: Record<ScenarioName, string> = {
  downside: '#c9822e',
  base: '#2f6cb2',
  upside: '#4d661a',
};

const SCENARIO_LABEL: Record<ScenarioName, string> = {
  downside: 'Downside',
  base: 'Base',
  upside: 'Upside',
};

function InfoDot({ title }: { title: string }) {
  return (
    <span className="inline-flex" title={title}>
      <Info size={10} className="text-faint" />
    </span>
  );
}

function NumInput({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  isPercent,
  isIDR,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  isPercent?: boolean;
  isIDR?: boolean;
}) {
  const displayValue = isPercent ? Math.round(value * 1000) / 10 : value;
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-mute font-bold flex items-center gap-1">
        {label}
        {hint && <InfoDot title={hint} />}
      </span>
      <div className="flex items-center gap-1.5 mt-1">
        {isIDR && <span className="text-[11px] text-faint shrink-0">Rp</span>}
        <input
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(displayValue) ? displayValue : 0}
          onChange={(e) => {
            const raw = Number(e.target.value) || 0;
            onChange(isPercent ? raw / 100 : raw);
          }}
          className="field !py-1.5 !px-2.5 text-sm w-full"
        />
        {(suffix || isPercent) && <span className="text-[11px] text-faint shrink-0">{isPercent ? '%' : suffix}</span>}
      </div>
    </label>
  );
}

function CheckboxField({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-3.5 h-3.5 accent-ink cursor-pointer" />
      <span className="text-xs text-inksoft flex items-center gap-1">
        {label}
        {hint && <InfoDot title={hint} />}
      </span>
    </label>
  );
}

function AssumptionSection({
  title,
  subtitle,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 bg-canvas-soft/40 hover:bg-canvas-soft transition-colors cursor-pointer text-left"
      >
        <div>
          <div className="text-xs font-semibold text-ink">{title}</div>
          <div className="text-[10px] text-faint mt-0.5">{subtitle}</div>
        </div>
        {open ? <ChevronUp size={14} className="text-mute shrink-0" /> : <ChevronDown size={14} className="text-mute shrink-0" />}
      </button>
      {open && <div className="p-4 bg-white border-t border-line grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3.5">{children}</div>}
    </div>
  );
}

function ScenarioCard({ name, summary, horizonMonths }: { name: ScenarioName; summary: OptionSummary; horizonMonths: number }) {
  const netAvg = summary.avgMonthlyBenefit.totalIDR - summary.avgMonthlyTco.totalIDR;
  return (
    <div className="bg-white border border-line rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="chip !text-[10px] font-bold border-transparent" style={{ background: `${SCENARIO_COLOR[name]}1a`, color: SCENARIO_COLOR[name] }}>
          {SCENARIO_LABEL[name]}
        </span>
        <span className="text-[10px] text-faint">/{horizonMonths}mo</span>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider text-mute font-bold">Payback</div>
        <div className="text-lg font-bold text-ink">{summary.paybackMonth !== null ? `${summary.paybackMonth} mo` : `> ${horizonMonths} mo`}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-faint">NPV</div>
          <div className={`font-semibold ${summary.npvIDR >= 0 ? 'text-emerald-700' : 'text-bad'}`}>{formatIDRCompact(summary.npvIDR)}</div>
        </div>
        <div>
          <div className="text-faint">Net/mo (avg)</div>
          <div className={`font-semibold ${netAvg >= 0 ? 'text-emerald-700' : 'text-bad'}`}>{formatIDRCompact(netAvg)}</div>
        </div>
      </div>
      <div className="pt-2.5 border-t border-line/60 space-y-1 text-[10px]">
        <div className="text-[9px] uppercase tracking-wider text-mute font-bold mb-1">Avg monthly TCO</div>
        {[
          ['Inference (tokens)', summary.avgMonthlyTco.inferenceCostIDR],
          ['Human review labor', summary.avgMonthlyTco.laborCostIDR],
          ['Maintenance', summary.avgMonthlyTco.maintenanceCostIDR],
          ['Infra (OCR/orch./log)', summary.avgMonthlyTco.infraCostIDR],
          ['Compliance/audit', summary.avgMonthlyTco.complianceCostIDR],
          ['Build (amortized)', summary.avgMonthlyTco.buildCostAmortizedIDR],
        ].map(([label, val]) => (
          <div key={label as string} className="flex items-center justify-between">
            <span className="text-mute">{label}</span>
            <span className="font-mono text-inksoft">{formatIDRCompact(val as number)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between font-semibold pt-1 border-t border-line/60">
          <span>Total TCO/mo</span>
          <span className="font-mono">{formatIDRCompact(summary.avgMonthlyTco.totalIDR)}</span>
        </div>
      </div>
      <div className="pt-2.5 border-t border-line/60 space-y-1 text-[10px]">
        <div className="text-[9px] uppercase tracking-wider text-mute font-bold mb-1">Avg monthly benefit</div>
        {[
          ['Hard cash savings', summary.avgMonthlyBenefit.hardCashSavingsIDR],
          ['Soft capacity (redeployed)', summary.avgMonthlyBenefit.softCapacityValueIDR],
          ['Leakage captured', summary.avgMonthlyBenefit.leakageCaptureIDR],
          ['− Error rework cost', -summary.avgMonthlyBenefit.errorReworkCostIDR],
        ].map(([label, val]) => (
          <div key={label as string} className="flex items-center justify-between">
            <span className="text-mute">{label}</span>
            <span className="font-mono text-inksoft">{formatIDRCompact(val as number)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between font-semibold pt-1 border-t border-line/60">
          <span>Total benefit/mo</span>
          <span className="font-mono">{formatIDRCompact(summary.avgMonthlyBenefit.totalIDR)}</span>
        </div>
      </div>
    </div>
  );
}

export default function FinanceRoiTcoPanel({
  proc,
  onSaveProcess,
}: {
  proc: Process;
  onSaveProcess?: (proc: Process) => void;
}) {
  const saved: SavedRoiTcoState | undefined = proc.savedRoiTco;
  const initialTemplate = saved
    ? FINANCE_PROCESS_TEMPLATES.find((t) => t.key === saved.templateKey) ?? FINANCE_PROCESS_TEMPLATES[0]
    : suggestTemplateForSubFunction(proc.subFunction);

  const [templateKey, setTemplateKey] = useState(initialTemplate.key);
  const [docsPerMonth, setDocsPerMonth] = useState(saved?.docsPerMonth ?? estimateMonthlyVolumeFromRating(proc.volumeRating));
  const [oldProcessMonthlyCostIDR, setOldProcessMonthlyCostIDR] = useState(saved?.oldProcessMonthlyCostIDR ?? 0);
  const [useProModel, setUseProModel] = useState(saved?.useProModel ?? false);
  const [horizonMonths, setHorizonMonths] = useState(saved?.horizonMonths ?? 24);
  const [discountRateAnnualPct, setDiscountRateAnnualPct] = useState(saved?.discountRateAnnualPct ?? 0.12);
  const [fxIdrPerUsd, setFxIdrPerUsd] = useState(saved?.fxIdrPerUsd ?? DEFAULT_FX_IDR_PER_USD);
  const [overrides, setOverrides] = useState<Overrides>(saved?.overrides ?? {});
  const [showHelp, setShowHelp] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const template = FINANCE_PROCESS_TEMPLATES.find((t) => t.key === templateKey) ?? FINANCE_PROCESS_TEMPLATES[0];

  const updateOverride = <G extends keyof Overrides>(group: G, field: keyof NonNullable<Overrides[G]>, value: number | boolean) => {
    setOverrides((prev) => ({
      ...prev,
      [group]: { ...(prev[group] as any), [field]: value },
    }));
    setJustSaved(false);
  };

  const config = useMemo(
    () =>
      buildDefaultConfig({
        template,
        docsPerMonth,
        oldProcessMonthlyCostIDR,
        useProModel,
        horizonMonths,
        discountRateAnnualPct,
        overrides,
      }),
    [template, docsPerMonth, oldProcessMonthlyCostIDR, useProModel, horizonMonths, discountRateAnnualPct, overrides]
  );
  // FX rate is applied as a display-time conversion for IDR-denominated fields
  // already baked in by buildDefaultConfig; overriding it here so a change to
  // the FX assumption still flows through to the engine's own fxIdrPerUsd (used for inference cost).
  const effectiveConfig = useMemo(() => ({ ...config, fxIdrPerUsd }), [config, fxIdrPerUsd]);

  const result = useMemo(() => runRoiTcoEngine(effectiveConfig), [effectiveConfig]);

  const chartData = useMemo(() => {
    return effectiveConfig ? result.scenarios.base.monthly.map((_, i) => ({
      month: i + 1,
      downside: Math.round(result.scenarios.downside.monthly[i].cumulativeCashFlowIDR),
      base: Math.round(result.scenarios.base.monthly[i].cumulativeCashFlowIDR),
      upside: Math.round(result.scenarios.upside.monthly[i].cumulativeCashFlowIDR),
    })) : [];
  }, [result, effectiveConfig]);

  const handleSave = () => {
    if (!onSaveProcess) return;
    const state: SavedRoiTcoState = {
      templateKey,
      docsPerMonth,
      oldProcessMonthlyCostIDR,
      useProModel,
      horizonMonths,
      discountRateAnnualPct,
      fxIdrPerUsd,
      overrides,
    };
    onSaveProcess({ ...proc, savedRoiTco: state });
    setJustSaved(true);
  };

  const exportAssumptionsCsv = () => {
    const rows: [string, string, string][] = [
      ['Process', config.processLabel, ''],
      ['Template', template.label, ''],
      ['Docs / month', String(docsPerMonth), 'docs'],
      ['Old process monthly cost', String(oldProcessMonthlyCostIDR), 'IDR'],
      ['Model tier', useProModel ? 'Gemini Pro' : 'Gemini Flash', ''],
      ['Horizon', String(horizonMonths), 'months'],
      ['Discount rate (annual)', String(discountRateAnnualPct), 'ratio'],
      ['FX rate', String(fxIdrPerUsd), 'IDR per USD'],
      ['— Volume —', '', ''],
      ['Pages / doc', String(effectiveConfig.volume.pagesPerDoc), ''],
      ['Passes / doc', String(effectiveConfig.volume.passesPerDoc), ''],
      ['Vision/PDF required', String(effectiveConfig.volume.visionRequired), ''],
      ['— Inference —', '', ''],
      ['Prompt overhead tokens', String(effectiveConfig.inference.promptOverheadTokens), 'tokens/call'],
      ['Few-shot tokens', String(effectiveConfig.inference.fewShotTokens), 'tokens/call'],
      ['Tokens / page', String(effectiveConfig.inference.tokensPerPage), 'tokens'],
      ['Output tokens / doc', String(effectiveConfig.inference.outputTokensPerDoc), 'tokens'],
      ['Text input rate', String(effectiveConfig.inference.textInputRateUsdPer1M), 'USD/1M tokens'],
      ['Output rate', String(effectiveConfig.inference.outputRateUsdPer1M), 'USD/1M tokens'],
      ['Vision multiplier', String(effectiveConfig.inference.visionInputMultiplier), 'x'],
      ['Retry rate', String(effectiveConfig.inference.retryRate), 'ratio'],
      ['— Labor —', '', ''],
      ['Review minutes / doc', String(effectiveConfig.labor.reviewMinutesPerDoc), 'minutes'],
      ['Review share', String(effectiveConfig.labor.reviewSharePct), 'ratio'],
      ['Loaded hourly wage', String(effectiveConfig.labor.loadedHourlyWageIDR), 'IDR/hour'],
      ['— Ops —', '', ''],
      ['Maintenance / month', String(effectiveConfig.ops.maintenanceMonthlyIDR), 'IDR'],
      ['Infra / month', String(effectiveConfig.ops.infraMonthlyIDR), 'IDR'],
      ['Compliance / month', String(effectiveConfig.ops.complianceMonthlyIDR), 'IDR'],
      ['Build cost (one-time)', String(effectiveConfig.ops.buildCostIDR), 'IDR'],
      ['Amortization', String(effectiveConfig.ops.amortizationMonths), 'months'],
      ['— Benefit —', '', ''],
      ['Hard cash savings / month', String(effectiveConfig.benefit.hardCashSavingsMonthlyIDR), 'IDR'],
      ['Soft capacity hours / month', String(effectiveConfig.benefit.softCapacityHoursPerMonth), 'hours'],
      ['Redeployment factor', String(effectiveConfig.benefit.redeploymentFactor), 'ratio'],
      ['Soft capacity hourly value', String(effectiveConfig.benefit.softCapacityHourlyValueIDR), 'IDR/hour'],
      ['Addressable leakage / month', String(effectiveConfig.benefit.addressableLeakageMonthlyIDR), 'IDR'],
      ['Addressable share', String(effectiveConfig.benefit.addressableSharePct), 'ratio'],
      ['Model capture rate', String(effectiveConfig.benefit.modelCaptureRatePct), 'ratio'],
      ['Accuracy rate', String(effectiveConfig.benefit.accuracyRate), 'ratio'],
      ['Cost per error', String(effectiveConfig.benefit.costPerErrorIDR), 'IDR'],
      ['— Ramp —', '', ''],
      ['Pilot months', String(effectiveConfig.ramp.pilotMonths), 'months'],
      ['Pilot volume share', String(effectiveConfig.ramp.pilotVolumeSharePct), 'ratio'],
      ['Pilot accuracy penalty', String(effectiveConfig.ramp.pilotAccuracyPenaltyPct), 'ratio'],
      ['Parallel-run months', String(effectiveConfig.ramp.parallelRunMonths), 'months'],
      ['Benefit ramp months', String(effectiveConfig.ramp.benefitRampMonths), 'months'],
      ['— RPA comparison —', '', ''],
      ['RPA license / month', String(effectiveConfig.rpa.licenseMonthlyIDR), 'IDR'],
      ['RPA bot dev (one-time)', String(effectiveConfig.rpa.botDevCostIDR), 'IDR'],
      ['RPA orchestration / month', String(effectiveConfig.rpa.orchestrationMonthlyIDR), 'IDR'],
      ['RPA maintenance / month', String(effectiveConfig.rpa.maintenanceMonthlyIDR), 'IDR'],
      ['RPA exception rate', String(effectiveConfig.rpa.exceptionRatePct), 'ratio'],
      ['RPA accuracy', String(effectiveConfig.rpa.accuracyRate), 'ratio'],
      ['RPA leakage capture rate', String(effectiveConfig.rpa.leakageCaptureRatePct), 'ratio'],
    ];
    downloadCsv(rows, ['Assumption', 'Value', 'Unit'], `roi_tco_assumptions_${proc.id}.csv`);
  };

  const exportResultsCsv = () => {
    const headers = ['Scenario', 'Month', 'Docs', 'TCO (IDR)', 'Benefit (IDR)', 'Old process cost (IDR)', 'Net cash flow (IDR)', 'Cumulative (IDR)'];
    const rows: string[][] = [];
    (Object.keys(result.scenarios) as ScenarioName[]).forEach((name) => {
      result.scenarios[name].monthly.forEach((m) => {
        rows.push([
          SCENARIO_LABEL[name],
          String(m.month),
          String(Math.round(m.docsProcessed)),
          String(Math.round(m.tco.totalIDR)),
          String(Math.round(m.benefit.totalIDR)),
          String(Math.round(m.oldProcessCostIDR)),
          String(Math.round(m.netCashFlowIDR)),
          String(Math.round(m.cumulativeCashFlowIDR)),
        ]);
      });
    });
    rows.push([]);
    rows.push(['Summary', '', '', '', '', '', '', '']);
    (Object.keys(result.scenarios) as ScenarioName[]).forEach((name) => {
      const s = result.scenarios[name];
      rows.push([SCENARIO_LABEL[name], 'Payback (months)', String(s.paybackMonth ?? `>${horizonMonths}`), 'NPV (IDR)', String(Math.round(s.npvIDR)), '', '', '']);
    });
    rows.push(['RPA-only', 'Payback (months)', String(result.rpaOnly.paybackMonth ?? `>${horizonMonths}`), 'NPV (IDR)', String(Math.round(result.rpaOnly.npvIDR)), '', '', '']);
    rows.push(['AI + Orchestration Hybrid', 'Payback (months)', String(result.hybrid.paybackMonth ?? `>${horizonMonths}`), 'NPV (IDR)', String(Math.round(result.hybrid.npvIDR)), '', '', '']);
    rows.push(['Sensitivity', result.sensitivity.summary, '', '', '', '', '', '']);
    downloadCsv(rows, headers, `roi_tco_results_${proc.id}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="text-citron-deep" />
          <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider">ROI / TCO Analysis — Group Finance</h4>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowHelp(!showHelp)} className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1.5">
            <HelpCircle size={12} /> {showHelp ? 'Hide' : 'How this works'}
          </button>
          {onSaveProcess && (
            <button
              onClick={handleSave}
              className={`${justSaved ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'btn-dark'} flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs font-semibold rounded-full`}
            >
              <Save size={12} /> {justSaved ? 'Saved ✓' : 'Save Analysis'}
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="bg-canvas border border-line rounded-2xl p-4 space-y-2 text-[11px] text-mute leading-relaxed">
          <p>
            <strong className="text-ink-soft">Why this replaced the old ROI card:</strong> the previous model compared a fixed RPA license price
            against a raw Gemini token bill and called the gap "ROI." Token/API cost is one line in a much bigger bill. This engine computes a full{' '}
            <strong className="text-ink-soft">Total Cost of Ownership</strong> (inference + human review labor + maintenance + infra + compliance +
            amortized integration build cost) and a benefit stack that keeps <strong className="text-ink-soft">hard cash</strong> separate from{' '}
            <strong className="text-ink-soft">soft capacity</strong> (hours freed only count once multiplied by a redeployment factor — otherwise
            they're slack, not savings) and subtracts the rework cost of the errors the model will still make.
          </p>
          <p>
            <strong className="text-ink-soft">Payback</strong> is computed on cumulative monthly cash flow through a realistic adoption ramp: a
            pilot at partial volume/accuracy, a parallel-run window where both the old process and the new one are paid at once, and benefits
            scaling up over a ramp curve — not an instant break-even. <strong className="text-ink-soft">NPV</strong> discounts that same cash-flow
            stream at your chosen annual rate. Every number above is editable and sourced from the shared "Daftar Harga Standar Indonesia" pricing
            table where possible — hover the <Info size={9} className="inline" /> icons for why each default was chosen.
          </p>
        </div>
      )}

      {/* Setup */}
      <div className="bg-canvas border border-line rounded-2xl p-4 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-mute font-bold">Finance process</span>
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className="field !py-1.5 !px-2.5 text-sm w-full mt-1 cursor-pointer">
              {FINANCE_PROCESS_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-faint mt-1 block">{template.description}</span>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-mute font-bold">Model tier</span>
            <select
              value={useProModel ? 'pro' : 'flash'}
              onChange={(e) => setUseProModel(e.target.value === 'pro')}
              className="field !py-1.5 !px-2.5 text-sm w-full mt-1 cursor-pointer"
            >
              <option value="flash">Gemini Flash — cheap, high-volume extraction</option>
              <option value="pro">Gemini Pro — deeper reasoning, pricier</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <NumInput label="Docs / month" hint="Pre-filled from this process's catalogue volume rating — fully editable." value={docsPerMonth} onChange={setDocsPerMonth} step={50} />
          <NumInput
            label="Old process cost"
            hint="Fully-loaded monthly cost of the manual/legacy process being replaced — the one input this engine cannot infer on its own."
            value={oldProcessMonthlyCostIDR}
            onChange={setOldProcessMonthlyCostIDR}
            step={500000}
            isIDR
          />
          <NumInput label="Horizon" hint="Total months modeled." value={horizonMonths} onChange={setHorizonMonths} step={1} suffix="months" />
          <NumInput label="Discount rate" hint="Annual rate used to compute NPV — typical internal hurdle rate." value={discountRateAnnualPct} onChange={setDiscountRateAnnualPct} step={1} isPercent />
        </div>
        <NumInput
          label="FX rate"
          hint="Applied to every USD-denominated assumption in the Daftar Harga Standar Indonesia pricing table."
          value={fxIdrPerUsd}
          onChange={setFxIdrPerUsd}
          step={100}
          suffix="IDR / USD"
        />
        {oldProcessMonthlyCostIDR === 0 && (
          <div className="flex items-center gap-2 text-[11px] text-warn bg-warn/10 border border-warn/30 rounded-xl px-3 py-2">
            <AlertTriangle size={12} className="shrink-0" /> Enter the old process's monthly cost — payback and the parallel-run comparison are meaningless at zero.
          </div>
        )}
      </div>

      {/* Assumption accordions */}
      <div className="space-y-2.5">
        <AssumptionSection title="Volume & document shape" subtitle={`${effectiveConfig.volume.pagesPerDoc} pages/doc · ${effectiveConfig.volume.passesPerDoc} passes/doc`}>
          <NumInput label="Pages / doc" value={effectiveConfig.volume.pagesPerDoc} onChange={(v) => updateOverride('volume', 'pagesPerDoc', v)} />
          <NumInput label="Passes / doc" hint="e.g. 2 = an extract pass + a validate pass." value={effectiveConfig.volume.passesPerDoc} onChange={(v) => updateOverride('volume', 'passesPerDoc', v)} />
          <div className="flex items-end">
            <CheckboxField
              label="Vision/PDF required"
              hint="Scanned/PDF docs tokenize pricier than clean extracted text — applies the vision multiplier."
              checked={effectiveConfig.volume.visionRequired}
              onChange={(v) => updateOverride('volume', 'visionRequired', v)}
            />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Inference sizing"
          subtitle={`${effectiveConfig.inference.textInputRateUsdPer1M} USD/1M in · ${effectiveConfig.inference.outputRateUsdPer1M} USD/1M out`}
        >
          <NumInput label="Prompt overhead" hint="System prompt / instructions, tokens per call." value={effectiveConfig.inference.promptOverheadTokens} onChange={(v) => updateOverride('inference', 'promptOverheadTokens', v)} step={50} suffix="tok" />
          <NumInput label="Few-shot tokens" hint="Examples included per call." value={effectiveConfig.inference.fewShotTokens} onChange={(v) => updateOverride('inference', 'fewShotTokens', v)} step={50} suffix="tok" />
          <NumInput label="Tokens / page" value={effectiveConfig.inference.tokensPerPage} onChange={(v) => updateOverride('inference', 'tokensPerPage', v)} step={25} suffix="tok" />
          <NumInput label="Output tokens / doc" value={effectiveConfig.inference.outputTokensPerDoc} onChange={(v) => updateOverride('inference', 'outputTokensPerDoc', v)} step={25} suffix="tok" />
          <NumInput label="Retry rate" hint="Share of calls needing an extra retry pass." value={effectiveConfig.inference.retryRate} onChange={(v) => updateOverride('inference', 'retryRate', v)} isPercent />
          <NumInput label="Text input rate" hint="From the Daftar Harga Standar Indonesia table (Gemini Flash/Pro input)." value={effectiveConfig.inference.textInputRateUsdPer1M} onChange={(v) => updateOverride('inference', 'textInputRateUsdPer1M', v)} step={0.01} suffix="USD/1M" />
          <NumInput label="Output rate" hint="From the pricing table (Gemini Flash/Pro output)." value={effectiveConfig.inference.outputRateUsdPer1M} onChange={(v) => updateOverride('inference', 'outputRateUsdPer1M', v)} step={0.01} suffix="USD/1M" />
          <NumInput label="Vision multiplier" hint="Pricing table: vision/PDF token premium over plain text." value={effectiveConfig.inference.visionInputMultiplier} onChange={(v) => updateOverride('inference', 'visionInputMultiplier', v)} step={0.1} suffix="x" />
        </AssumptionSection>

        <AssumptionSection title="Human-in-the-loop review labor" subtitle={`${effectiveConfig.labor.reviewMinutesPerDoc} min/doc · ${Math.round(effectiveConfig.labor.reviewSharePct * 100)}% reviewed`}>
          <NumInput label="Review minutes / doc" value={effectiveConfig.labor.reviewMinutesPerDoc} onChange={(v) => updateOverride('labor', 'reviewMinutesPerDoc', v)} step={0.5} />
          <NumInput label="Review share" hint="Share of docs a human actually reviews (sampling vs 100%)." value={effectiveConfig.labor.reviewSharePct} onChange={(v) => updateOverride('labor', 'reviewSharePct', v)} isPercent />
          <NumInput label="Loaded hourly wage" hint="Pricing table: fully-loaded reviewer wage (incl. BPJS/THR overhead)." value={effectiveConfig.labor.loadedHourlyWageIDR} onChange={(v) => updateOverride('labor', 'loadedHourlyWageIDR', v)} step={5000} isIDR />
        </AssumptionSection>

        <AssumptionSection title="Ongoing ops cost" subtitle={`${formatIDRCompact(effectiveConfig.ops.maintenanceMonthlyIDR + effectiveConfig.ops.infraMonthlyIDR + effectiveConfig.ops.complianceMonthlyIDR)}/mo fixed`}>
          <NumInput label="Maintenance / month" hint="Prompt/version upkeep — pricing table default." value={effectiveConfig.ops.maintenanceMonthlyIDR} onChange={(v) => updateOverride('ops', 'maintenanceMonthlyIDR', v)} step={100000} isIDR />
          <NumInput label="Infra / month" hint="Doc-AI/OCR + orchestration + storage/logging, summed from the pricing table." value={effectiveConfig.ops.infraMonthlyIDR} onChange={(v) => updateOverride('ops', 'infraMonthlyIDR', v)} step={100000} isIDR />
          <NumInput label="Compliance / month" hint="Audit trail + PDP review — pricing table default." value={effectiveConfig.ops.complianceMonthlyIDR} onChange={(v) => updateOverride('ops', 'complianceMonthlyIDR', v)} step={100000} isIDR />
          <NumInput label="Build cost (one-time)" hint="ERP/source-system integration — dev hours × blended dev rate from the pricing table." value={effectiveConfig.ops.buildCostIDR} onChange={(v) => updateOverride('ops', 'buildCostIDR', v)} step={1000000} isIDR />
          <NumInput label="Amortize over" hint="Months the build cost is spread across — set to 1 to treat it as an upfront cash outlay instead." value={effectiveConfig.ops.amortizationMonths} onChange={(v) => updateOverride('ops', 'amortizationMonths', Math.max(1, v))} suffix="months" />
        </AssumptionSection>

        <AssumptionSection title="Benefit — hard, soft, and leakage" subtitle="separates cash from capacity, subtracts error rework">
          <NumInput label="Hard cash savings / month" hint="Contractual/cash savings once fully ramped (e.g. reduced outsourcing spend, headcount avoidance)." value={effectiveConfig.benefit.hardCashSavingsMonthlyIDR} onChange={(v) => updateOverride('benefit', 'hardCashSavingsMonthlyIDR', v)} step={1000000} isIDR />
          <NumInput label="Soft capacity hours / month" hint="Hours freed — NOT cash unless redeployed (see redeployment factor)." value={effectiveConfig.benefit.softCapacityHoursPerMonth} onChange={(v) => updateOverride('benefit', 'softCapacityHoursPerMonth', v)} step={10} suffix="hrs" />
          <NumInput label="Redeployment factor" hint="Share of freed hours that convert into real redeployed capacity value. Default 0.4 — most freed time becomes slack, not output, unless actively redeployed." value={effectiveConfig.benefit.redeploymentFactor} onChange={(v) => updateOverride('benefit', 'redeploymentFactor', v)} isPercent />
          <NumInput label="Soft capacity hourly value" value={effectiveConfig.benefit.softCapacityHourlyValueIDR} onChange={(v) => updateOverride('benefit', 'softCapacityHourlyValueIDR', v)} step={5000} isIDR />
          <NumInput label="Addressable leakage / month" hint="e.g. late-payment fees, missed discounts, unresolved recon breaks." value={effectiveConfig.benefit.addressableLeakageMonthlyIDR} onChange={(v) => updateOverride('benefit', 'addressableLeakageMonthlyIDR', v)} step={1000000} isIDR />
          <NumInput label="Addressable share" hint="Share of that leakage this process actually touches." value={effectiveConfig.benefit.addressableSharePct} onChange={(v) => updateOverride('benefit', 'addressableSharePct', v)} isPercent />
          <NumInput label="Model capture rate" hint="Share of addressable leakage the model actually catches." value={effectiveConfig.benefit.modelCaptureRatePct} onChange={(v) => updateOverride('benefit', 'modelCaptureRatePct', v)} isPercent />
          <NumInput label="Accuracy rate" value={effectiveConfig.benefit.accuracyRate} onChange={(v) => updateOverride('benefit', 'accuracyRate', v)} isPercent />
          <NumInput label="Cost per error" hint="Rework cost per inaccurate doc." value={effectiveConfig.benefit.costPerErrorIDR} onChange={(v) => updateOverride('benefit', 'costPerErrorIDR', v)} step={10000} isIDR />
        </AssumptionSection>

        <AssumptionSection title="Adoption ramp" subtitle={`${effectiveConfig.ramp.pilotMonths}mo pilot · ${effectiveConfig.ramp.parallelRunMonths}mo parallel run`}>
          <NumInput label="Pilot months" hint="Months at partial volume + partial accuracy before scaling up." value={effectiveConfig.ramp.pilotMonths} onChange={(v) => updateOverride('ramp', 'pilotMonths', v)} suffix="months" />
          <NumInput label="Pilot volume share" value={effectiveConfig.ramp.pilotVolumeSharePct} onChange={(v) => updateOverride('ramp', 'pilotVolumeSharePct', v)} isPercent />
          <NumInput label="Pilot accuracy penalty" hint="Absolute points subtracted from accuracy during the pilot." value={effectiveConfig.ramp.pilotAccuracyPenaltyPct} onChange={(v) => updateOverride('ramp', 'pilotAccuracyPenaltyPct', v)} isPercent />
          <NumInput label="Parallel-run months" hint="Months where BOTH the old process cost and the new TCO are paid. Longer parallel run = longer payback — that's intentional, it reflects a real transition cost." value={effectiveConfig.ramp.parallelRunMonths} onChange={(v) => updateOverride('ramp', 'parallelRunMonths', v)} suffix="months" />
          <NumInput label="Benefit ramp" hint="Months after the pilot for volume/benefit to reach 100%." value={effectiveConfig.ramp.benefitRampMonths} onChange={(v) => updateOverride('ramp', 'benefitRampMonths', v)} suffix="months" />
        </AssumptionSection>

        <AssumptionSection title="RPA comparison inputs" subtitle="license + bot dev + orchestration + maintenance — not license alone">
          <NumInput label="RPA license / month" value={effectiveConfig.rpa.licenseMonthlyIDR} onChange={(v) => updateOverride('rpa', 'licenseMonthlyIDR', v)} step={100000} isIDR />
          <NumInput label="Bot dev (one-time)" value={effectiveConfig.rpa.botDevCostIDR} onChange={(v) => updateOverride('rpa', 'botDevCostIDR', v)} step={1000000} isIDR />
          <NumInput label="Orchestration / month" value={effectiveConfig.rpa.orchestrationMonthlyIDR} onChange={(v) => updateOverride('rpa', 'orchestrationMonthlyIDR', v)} step={50000} isIDR />
          <NumInput label="Maintenance / month" value={effectiveConfig.rpa.maintenanceMonthlyIDR} onChange={(v) => updateOverride('rpa', 'maintenanceMonthlyIDR', v)} step={100000} isIDR />
          <NumInput label="Exception rate" hint="Share of docs RPA can't handle and routes to a human." value={effectiveConfig.rpa.exceptionRatePct} onChange={(v) => updateOverride('rpa', 'exceptionRatePct', v)} isPercent />
          <NumInput label="RPA accuracy" hint="Typically high on the well-structured slice RPA can handle at all." value={effectiveConfig.rpa.accuracyRate} onChange={(v) => updateOverride('rpa', 'accuracyRate', v)} isPercent />
          <NumInput label="RPA leakage capture" hint="Typically lower than AI — RPA can't read unstructured content to catch leakage." value={effectiveConfig.rpa.leakageCaptureRatePct} onChange={(v) => updateOverride('rpa', 'leakageCaptureRatePct', v)} isPercent />
        </AssumptionSection>
      </div>

      {/* Scenario cards */}
      <div className="space-y-2.5">
        <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider">Scenarios — AI option</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['downside', 'base', 'upside'] as ScenarioName[]).map((name) => (
            <ScenarioCard key={name} name={name} summary={result.scenarios[name]} horizonMonths={horizonMonths} />
          ))}
        </div>
      </div>

      {/* Sensitivity one-liner */}
      <div className="bg-gradient-to-r from-emerald-50/50 via-teal-50/25 to-canvas-soft border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
          <TrendingUp size={14} />
        </div>
        <p className="text-[11px] text-mute leading-relaxed">{result.sensitivity.summary}</p>
      </div>

      {/* Cumulative cash flow chart */}
      <div className="bg-white border border-line rounded-2xl p-4">
        <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider mb-3">Cumulative net cash flow (AI option, IDR)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="baseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SCENARIO_COLOR.base} stopOpacity={0.18} />
                <stop offset="95%" stopColor={SCENARIO_COLOR.base} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatIDRCompact(v)} width={70} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatIDR(v)} labelFormatter={(m) => `Month ${m}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="downside" name="Downside" stroke={SCENARIO_COLOR.downside} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Area type="monotone" dataKey="base" name="Base" stroke={SCENARIO_COLOR.base} fill="url(#baseFill)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="upside" name="Upside" stroke={SCENARIO_COLOR.upside} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* RPA / AI / Hybrid comparison */}
      <div className="bg-canvas border border-line rounded-2xl p-4.5 space-y-3">
        <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">RPA vs. AI vs. AI + Orchestration (base scenario)</h4>
        <p className="text-[10px] text-faint -mt-2">
          Modeled as complementary options, not pure substitutes — RPA priced honestly (license + bot dev + orchestration + maintenance), and a
          hybrid where AI handles the cognitive extraction while a lighter orchestration layer wires it into existing systems.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-faint uppercase text-[9px] tracking-wider">
                <th className="pb-2 pr-3"></th>
                <th className="pb-2 pr-3"><span className="inline-flex items-center gap-1"><Bot size={11} /> RPA only</span></th>
                <th className="pb-2 pr-3"><span className="inline-flex items-center gap-1"><Cpu size={11} /> AI only</span></th>
                <th className="pb-2 pr-3"><span className="inline-flex items-center gap-1"><Combine size={11} /> AI + Orchestration</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              <tr>
                <td className="py-2 pr-3 font-semibold text-ink">Avg monthly TCO</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.rpaOnly.avgMonthlyTco.totalIDR)}</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.scenarios.base.avgMonthlyTco.totalIDR)}</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.hybrid.avgMonthlyTco.totalIDR)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-semibold text-ink">Avg monthly benefit</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.rpaOnly.avgMonthlyBenefit.totalIDR)}</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.scenarios.base.avgMonthlyBenefit.totalIDR)}</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.hybrid.avgMonthlyBenefit.totalIDR)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-semibold text-ink">Payback</td>
                <td className="py-2 pr-3">{result.rpaOnly.paybackMonth !== null ? `${result.rpaOnly.paybackMonth} mo` : `> ${horizonMonths} mo`}</td>
                <td className="py-2 pr-3">{result.scenarios.base.paybackMonth !== null ? `${result.scenarios.base.paybackMonth} mo` : `> ${horizonMonths} mo`}</td>
                <td className="py-2 pr-3">{result.hybrid.paybackMonth !== null ? `${result.hybrid.paybackMonth} mo` : `> ${horizonMonths} mo`}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-semibold text-ink">NPV</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.rpaOnly.npvIDR)}</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.scenarios.base.npvIDR)}</td>
                <td className="py-2 pr-3 font-mono">{formatIDRCompact(result.hybrid.npvIDR)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={exportAssumptionsCsv} className="bg-white hover:bg-canvas-soft border border-line hover:border-faint text-ink font-semibold flex items-center gap-1.5 !py-2 !px-4 text-xs rounded-full transition-all shadow-sm cursor-pointer">
          <Download size={13} /> Export Assumptions (CSV)
        </button>
        <button onClick={exportResultsCsv} className="bg-white hover:bg-canvas-soft border border-line hover:border-faint text-ink font-semibold flex items-center gap-1.5 !py-2 !px-4 text-xs rounded-full transition-all shadow-sm cursor-pointer">
          <Download size={13} /> Export Results (CSV)
        </button>
        <span className="text-[10px] text-faint">Sourced from {PRICING_STANDARDS.length} rates in the Daftar Harga Standar Indonesia table.</span>
      </div>
    </div>
  );
}

function downloadCsv(rows: (string | number)[][], headers: string[], filename: string) {
  const escape = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csvContent = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
