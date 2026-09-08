/**
 * ROI / TCO calculation engine for group-finance document & process
 * automation (AP invoicing, intercompany recon, month-end close support,
 * management reporting, tax & compliance docs, or any other process
 * described through the same config shape).
 *
 * This module is deliberately framework-agnostic (no React, no server
 * imports) so it can run both client-side (src/components/FinanceRoiTcoPanel.tsx,
 * for instant recompute as the user edits assumptions) and server-side
 * (server.ts's POST /api/finance/roi-tco, for parity/scriptable access),
 * matching how the rest of the app splits calculation logic from UI.
 *
 * WHY THIS EXISTS: the deployment-plan estimator this replaces compared a
 * fixed RPA license price against a raw Gemini token bill and called the
 * difference "ROI." Token cost is one line item, not the total cost of
 * running the process. This engine models the full Total Cost of Ownership,
 * separates hard cash benefit from soft capacity value, and computes payback
 * against a realistic adoption ramp instead of an instant break-even.
 */

// ---------------------------------------------------------------------------
// Config types — every field here is a user-editable assumption, never a
// hardcoded constant inside the calculation functions below.
// ---------------------------------------------------------------------------

export interface VolumeInputs {
  docsPerMonth: number;
  pagesPerDoc: number;
  passesPerDoc: number; // e.g. 2 = an extract pass + a validate pass per doc
  visionRequired: boolean; // true = source docs are scans/PDFs, not clean text
}

export interface InferenceAssumptions {
  promptOverheadTokens: number; // system prompt / instructions, per call
  fewShotTokens: number; // few-shot examples included per call
  tokensPerPage: number; // doc-content tokens per page
  outputTokensPerDoc: number; // structured output tokens, per doc (not per pass)
  textInputRateUsdPer1M: number; // sourced from pricingStandards (gemini_flash_input / gemini_pro_input)
  outputRateUsdPer1M: number; // sourced from pricingStandards (gemini_flash_output / gemini_pro_output)
  visionInputMultiplier: number; // sourced from pricingStandards (vision_pdf_token_multiplier)
  retryRate: number; // 0-1, share of calls needing an extra retry pass
}

export interface LaborAssumptions {
  reviewMinutesPerDoc: number;
  reviewSharePct: number; // 0-1, share of docs a human actually reviews
  loadedHourlyWageIDR: number; // sourced from pricingStandards (reviewer_loaded_wage)
}

export interface OpsAssumptions {
  maintenanceMonthlyIDR: number; // prompt/version upkeep — sourced from prompt_maintenance_monthly
  infraMonthlyIDR: number; // doc-AI/OCR + orchestration + storage/logging, summed
  complianceMonthlyIDR: number; // audit trail / PDP review — sourced from compliance_audit_monthly
  buildCostIDR: number; // one-time ERP/source-system integration cost
  amortizationMonths: number; // months over which buildCostIDR is spread (>=1)
}

export interface BenefitAssumptions {
  hardCashSavingsMonthlyIDR: number; // contractual/cash savings once fully ramped (e.g. reduced outsourcing spend)
  softCapacityHoursPerMonth: number; // hours freed — NOT cash unless redeployed
  redeploymentFactor: number; // 0-1, share of freed hours converted into real capacity value (default 0.4)
  softCapacityHourlyValueIDR: number; // value per redeployed hour
  addressableLeakageMonthlyIDR: number; // e.g. late-payment fees, missed discounts, recon breaks left unresolved
  addressableSharePct: number; // 0-1, share of that leakage this process actually touches
  modelCaptureRatePct: number; // 0-1, share of the addressable leakage the model actually catches
  accuracyRate: number; // 0-1
  costPerErrorIDR: number; // rework cost per inaccurate doc
}

export interface RampAssumptions {
  pilotMonths: number; // months at partial volume + partial accuracy
  pilotVolumeSharePct: number; // 0-1, share of full volume run during the pilot
  pilotAccuracyPenaltyPct: number; // subtracted from accuracyRate during the pilot (absolute points, e.g. 0.05)
  parallelRunMonths: number; // months where BOTH the old process cost and the new TCO are paid
  benefitRampMonths: number; // months after the pilot for volume/benefit to reach 100%
}

export interface RpaAssumptions {
  licenseMonthlyIDR: number; // sourced from rpa_runtime_license
  botDevCostIDR: number; // one-time — sourced from rpa_bot_dev_cost
  orchestrationMonthlyIDR: number; // sourced from orchestration_platform
  maintenanceMonthlyIDR: number; // sourced from rpa_maintenance_monthly
  amortizationMonths: number;
  exceptionRatePct: number; // 0-1, share of docs RPA can't handle and routes to a human
  accuracyRate: number; // 0-1 — RPA is typically very accurate on well-structured docs
  leakageCaptureRatePct: number; // 0-1 — typically lower than AI: RPA can't read unstructured content
}

export interface RoiEngineConfig {
  processLabel: string;
  horizonMonths: number; // total months modeled
  fxIdrPerUsd: number;
  discountRateAnnualPct: number; // for NPV, e.g. 0.12
  oldProcessMonthlyCostIDR: number; // cost of the manual/legacy process being replaced
  volume: VolumeInputs;
  inference: InferenceAssumptions;
  labor: LaborAssumptions;
  ops: OpsAssumptions;
  benefit: BenefitAssumptions;
  ramp: RampAssumptions;
  rpa: RpaAssumptions;
}

export type ScenarioName = 'downside' | 'base' | 'upside';

/** Multipliers applied to the five inputs the spec calls out as uncertain. */
export interface ScenarioMultipliers {
  tokensPerDocMult: number;
  accuracyMult: number; // multiplies accuracyRate, then clamps to [0, 0.999]
  captureRateMult: number; // multiplies modelCaptureRatePct / leakageCaptureRatePct
  buildCostMult: number;
  volumeMult: number;
}

export const SCENARIO_MULTIPLIERS: Record<ScenarioName, ScenarioMultipliers> = {
  downside: { tokensPerDocMult: 1.3, accuracyMult: 0.9, captureRateMult: 0.6, buildCostMult: 1.3, volumeMult: 0.8 },
  base: { tokensPerDocMult: 1, accuracyMult: 1, captureRateMult: 1, buildCostMult: 1, volumeMult: 1 },
  upside: { tokensPerDocMult: 0.85, accuracyMult: 1.05, captureRateMult: 1.3, buildCostMult: 0.85, volumeMult: 1.15 },
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface MonthRow {
  month: number; // 1-indexed
  docsProcessed: number;
  tco: {
    inferenceCostIDR: number;
    laborCostIDR: number;
    maintenanceCostIDR: number;
    infraCostIDR: number;
    complianceCostIDR: number;
    buildCostAmortizedIDR: number;
    totalIDR: number;
  };
  benefit: {
    hardCashSavingsIDR: number;
    avoidedOldProcessCostIDR: number; // the old process's cost you stop paying once it's decommissioned — see monthlyBenefit()
    leakageCaptureIDR: number;
    errorReworkCostIDR: number; // positive number, subtracted in totalIDR
    /** Reported for visibility (line item, CSV export) but NOT part of totalIDR —
     *  see the "man-hours saved" note above monthlyBenefit() for why it's kept
     *  out of the cash-driven payback/NPV math. */
    softCapacityValueIDR: number;
    totalIDR: number; // hardCash + avoidedOldProcessCost + leakageCapture - errorRework (soft capacity excluded on purpose)
  };
  oldProcessCostIDR: number; // >0 only while still running in parallel (the double-running cost, not the avoided-cost benefit)
  netCashFlowIDR: number; // benefit.totalIDR - tco.totalIDR - oldProcessCostIDR
  cumulativeCashFlowIDR: number;
}

export interface OptionSummary {
  monthly: MonthRow[];
  paybackMonth: number | null; // fractional month, null = not reached within horizon
  npvIDR: number;
  totalBenefitIDR: number;
  totalCostIDR: number; // TCO + parallel-run old-process cost, summed over horizon
  avgMonthlyTco: MonthRow['tco'];
  avgMonthlyBenefit: MonthRow['benefit'];
}

/**
 * A dead-simple "what would this cost to build and keep running" answer,
 * deliberately decoupled from the scenario/ramp/payback machinery above —
 * no discounting, no adoption curve, just: one-time build cost, and the
 * monthly/annual run cost once the process is fully live at 100% volume
 * and full accuracy (the base scenario, un-ramped).
 */
export interface BuildRunCostSummary {
  oneTimeBuildCostIDR: number;
  monthlyRunCost: {
    inferenceCostIDR: number;
    laborCostIDR: number;
    maintenanceCostIDR: number;
    infraCostIDR: number;
    complianceCostIDR: number;
    totalIDR: number; // excludes the one-time build cost — that's reported separately, not amortized
  };
  annualRunCostIDR: number; // monthlyRunCost.totalIDR * 12
}

/**
 * Man-hours saved, reported as its own calculation — hours, not folded into
 * a cash figure the reader has to untangle from payback. The monetized
 * "redeployed value" is included for reference but is explicitly informational: see monthlyBenefit().
 */
export interface ManHoursSavedSummary {
  hoursPerMonth: number; // softCapacityHoursPerMonth, at full (un-ramped) realization
  hoursPerYear: number;
  redeploymentFactor: number; // 0-1, share assumed to convert into real redeployed output
  redeployedValueMonthlyIDR: number; // hoursPerMonth * redeploymentFactor * softCapacityHourlyValueIDR — informational only
  redeployedValueAnnualIDR: number;
}

export interface RoiEngineResult {
  scenarios: Record<ScenarioName, OptionSummary>; // the AI option, across scenarios
  rpaOnly: OptionSummary; // RPA option, base scenario
  hybrid: OptionSummary; // AI + orchestration option, base scenario
  buildAndRunCost: BuildRunCostSummary;
  manHoursSaved: ManHoursSavedSummary;
  sensitivity: {
    inputKey: keyof ScenarioMultipliers;
    inputLabel: string;
    paybackSwingMonths: number;
    npvSwingIDR: number;
    summary: string; // one-line, ready to render
  };
}

// ---------------------------------------------------------------------------
// Shared ramp helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Share of full volume actually flowing through the new process in a given month (1-indexed). */
function volumeShareAt(ramp: RampAssumptions, month: number): number {
  if (month <= ramp.pilotMonths) return ramp.pilotVolumeSharePct;
  const monthsSincePilot = month - ramp.pilotMonths;
  const rampProgress = clamp(monthsSincePilot / Math.max(1, ramp.benefitRampMonths), 0, 1);
  return ramp.pilotVolumeSharePct + (1 - ramp.pilotVolumeSharePct) * rampProgress;
}

/** Accuracy in a given month — depressed during the pilot, full afterwards (tuning is assumed done by then). */
function accuracyAt(baseAccuracy: number, ramp: RampAssumptions, month: number): number {
  const acc = month <= ramp.pilotMonths ? baseAccuracy - ramp.pilotAccuracyPenaltyPct : baseAccuracy;
  return clamp(acc, 0, 0.999);
}

// ---------------------------------------------------------------------------
// AI option — monthly TCO
// ---------------------------------------------------------------------------

function aiMonthlyTco(
  cfg: RoiEngineConfig,
  month: number,
  mult: ScenarioMultipliers,
  docsThisMonth: number
): MonthRow['tco'] {
  const { inference, labor, ops, volume } = cfg;

  const docContentTokensPerCall = inference.tokensPerPage * volume.pagesPerDoc * mult.tokensPerDocMult;
  const docContentRateUsdPer1M = volume.visionRequired
    ? inference.textInputRateUsdPer1M * inference.visionInputMultiplier
    : inference.textInputRateUsdPer1M;

  const callsPerDoc = volume.passesPerDoc * (1 + inference.retryRate);
  const totalCalls = docsThisMonth * callsPerDoc;

  const overheadInputTokens = totalCalls * (inference.promptOverheadTokens + inference.fewShotTokens);
  const docContentTokens = totalCalls * docContentTokensPerCall;
  const outputTokens = docsThisMonth * callsPerDoc * inference.outputTokensPerDoc;

  const overheadCostUsd = (overheadInputTokens / 1_000_000) * inference.textInputRateUsdPer1M;
  const docContentCostUsd = (docContentTokens / 1_000_000) * docContentRateUsdPer1M;
  const outputCostUsd = (outputTokens / 1_000_000) * inference.outputRateUsdPer1M;

  const inferenceCostIDR = (overheadCostUsd + docContentCostUsd + outputCostUsd) * cfg.fxIdrPerUsd;

  const reviewedDocs = docsThisMonth * labor.reviewSharePct;
  const reviewHours = (reviewedDocs * labor.reviewMinutesPerDoc) / 60;
  const laborCostIDR = reviewHours * labor.loadedHourlyWageIDR;

  const buildCostAmortizedIDR =
    month <= ops.amortizationMonths ? (ops.buildCostIDR * mult.buildCostMult) / ops.amortizationMonths : 0;

  const totalIDR =
    inferenceCostIDR + laborCostIDR + ops.maintenanceMonthlyIDR + ops.infraMonthlyIDR + ops.complianceMonthlyIDR + buildCostAmortizedIDR;

  return {
    inferenceCostIDR,
    laborCostIDR,
    maintenanceCostIDR: ops.maintenanceMonthlyIDR,
    infraCostIDR: ops.infraMonthlyIDR,
    complianceCostIDR: ops.complianceMonthlyIDR,
    buildCostAmortizedIDR,
    totalIDR,
  };
}

// ---------------------------------------------------------------------------
// RPA option — monthly TCO (license + bot dev + orchestration + maintenance,
// honestly, not license alone) — plus exception-handling labor since RPA
// routes anything it can't parse to a human, same as AI does with low-confidence docs.
// ---------------------------------------------------------------------------

function rpaMonthlyTco(cfg: RoiEngineConfig, month: number, mult: ScenarioMultipliers, docsThisMonth: number): MonthRow['tco'] {
  const { rpa, labor } = cfg;

  const exceptionDocs = docsThisMonth * rpa.exceptionRatePct;
  const exceptionHours = (exceptionDocs * labor.reviewMinutesPerDoc) / 60;
  const laborCostIDR = exceptionHours * labor.loadedHourlyWageIDR;

  const botDevAmortizedIDR =
    month <= rpa.amortizationMonths ? (rpa.botDevCostIDR * mult.buildCostMult) / rpa.amortizationMonths : 0;

  const totalIDR = rpa.licenseMonthlyIDR + rpa.orchestrationMonthlyIDR + rpa.maintenanceMonthlyIDR + botDevAmortizedIDR + laborCostIDR;

  return {
    inferenceCostIDR: 0, // RPA does not call an LLM
    laborCostIDR,
    maintenanceCostIDR: rpa.maintenanceMonthlyIDR,
    infraCostIDR: rpa.licenseMonthlyIDR + rpa.orchestrationMonthlyIDR,
    complianceCostIDR: 0,
    buildCostAmortizedIDR: botDevAmortizedIDR,
    totalIDR,
  };
}

// ---------------------------------------------------------------------------
// Hybrid option — AI does the cognitive extraction/validation, a lighter
// orchestration layer (not full RPA bots) wires it into existing systems.
// Complementary, not a pure substitute for either AI-only or RPA-only.
// ---------------------------------------------------------------------------

function hybridMonthlyTco(cfg: RoiEngineConfig, month: number, mult: ScenarioMultipliers, docsThisMonth: number): MonthRow['tco'] {
  const ai = aiMonthlyTco(cfg, month, mult, docsThisMonth);
  const orchestrationIDR = cfg.rpa.orchestrationMonthlyIDR;
  return {
    ...ai,
    infraCostIDR: ai.infraCostIDR + orchestrationIDR,
    totalIDR: ai.totalIDR + orchestrationIDR,
  };
}

// ---------------------------------------------------------------------------
// Benefit — shared across all three options, parameterized by accuracy and
// leakage-capture rate since RPA and AI genuinely differ on those.
// ---------------------------------------------------------------------------

function monthlyBenefit(
  cfg: RoiEngineConfig,
  month: number,
  mult: ScenarioMultipliers,
  docsThisMonth: number,
  accuracy: number,
  captureRatePct: number
): MonthRow['benefit'] {
  const { benefit, ramp } = cfg;
  const realization = volumeShareAt(ramp, month);

  const hardCashSavingsIDR = benefit.hardCashSavingsMonthlyIDR * realization;

  // THE MAIN AVOIDED COST: while the old and new processes run in parallel
  // (month <= ramp.parallelRunMonths), you're paying for both — that cost is
  // charged separately as `oldProcessCostIDR` in runOption(), not a benefit.
  // Once the parallel run ends, the old process is decommissioned and you
  // stop paying oldProcessMonthlyCostIDR — THAT'S the benefit, scaled by how
  // much volume has actually shifted over (realization). Previously this
  // number was never converted into a benefit at all: it only ever added a
  // temporary cost during the parallel-run window and then vanished for the
  // rest of the horizon, so typing a bigger "old process cost" barely moved
  // payback/NPV and never moved "Total benefit" — it looked like the
  // calculator was ignoring the input. This is that fix.
  const avoidedOldProcessCostIDR = month > ramp.parallelRunMonths ? cfg.oldProcessMonthlyCostIDR * realization : 0;

  const leakageCaptureIDR =
    benefit.addressableLeakageMonthlyIDR *
    benefit.addressableSharePct *
    clamp(captureRatePct * mult.captureRateMult, 0, 1) *
    realization;

  const errorReworkCostIDR = docsThisMonth * (1 - accuracy) * benefit.costPerErrorIDR;

  // Man-hours saved ("soft capacity") is reported per month for the line-item
  // display and CSV export, but is NOT part of totalIDR — see
  // ManHoursSavedSummary / computeManHoursSaved() for the dedicated,
  // decoupled calculation. Hours freed are an operational fact regardless of
  // whether they get redeployed into real output; blending a haircut-by-
  // redeploymentFactor guess into the cash-driven payback number just makes
  // both numbers harder to trust. (Kept computed here only so a future
  // month-by-month hours chart doesn't need re-plumbing.)
  const softCapacityValueIDR =
    benefit.softCapacityHoursPerMonth * realization * benefit.redeploymentFactor * benefit.softCapacityHourlyValueIDR;

  const totalIDR = hardCashSavingsIDR + avoidedOldProcessCostIDR + leakageCaptureIDR - errorReworkCostIDR;

  return { hardCashSavingsIDR, avoidedOldProcessCostIDR, leakageCaptureIDR, errorReworkCostIDR, softCapacityValueIDR, totalIDR };
}

// ---------------------------------------------------------------------------
// Series runner — shared by AI/RPA/Hybrid options and by every scenario.
// ---------------------------------------------------------------------------

function sumTco(rows: MonthRow['tco'][]): MonthRow['tco'] {
  const n = rows.length || 1;
  return {
    inferenceCostIDR: rows.reduce((s, r) => s + r.inferenceCostIDR, 0) / n,
    laborCostIDR: rows.reduce((s, r) => s + r.laborCostIDR, 0) / n,
    maintenanceCostIDR: rows.reduce((s, r) => s + r.maintenanceCostIDR, 0) / n,
    infraCostIDR: rows.reduce((s, r) => s + r.infraCostIDR, 0) / n,
    complianceCostIDR: rows.reduce((s, r) => s + r.complianceCostIDR, 0) / n,
    buildCostAmortizedIDR: rows.reduce((s, r) => s + r.buildCostAmortizedIDR, 0) / n,
    totalIDR: rows.reduce((s, r) => s + r.totalIDR, 0) / n,
  };
}

function sumBenefit(rows: MonthRow['benefit'][]): MonthRow['benefit'] {
  const n = rows.length || 1;
  return {
    hardCashSavingsIDR: rows.reduce((s, r) => s + r.hardCashSavingsIDR, 0) / n,
    avoidedOldProcessCostIDR: rows.reduce((s, r) => s + r.avoidedOldProcessCostIDR, 0) / n,
    softCapacityValueIDR: rows.reduce((s, r) => s + r.softCapacityValueIDR, 0) / n,
    leakageCaptureIDR: rows.reduce((s, r) => s + r.leakageCaptureIDR, 0) / n,
    errorReworkCostIDR: rows.reduce((s, r) => s + r.errorReworkCostIDR, 0) / n,
    totalIDR: rows.reduce((s, r) => s + r.totalIDR, 0) / n,
  };
}

function runOption(
  cfg: RoiEngineConfig,
  mult: ScenarioMultipliers,
  costFn: (cfg: RoiEngineConfig, month: number, mult: ScenarioMultipliers, docs: number) => MonthRow['tco'],
  accuracyBase: number,
  captureRatePct: number
): OptionSummary {
  const monthly: MonthRow[] = [];
  let cumulative = 0;
  const monthlyDiscountRate = Math.pow(1 + cfg.discountRateAnnualPct, 1 / 12) - 1;
  let npvIDR = 0;

  for (let month = 1; month <= cfg.horizonMonths; month++) {
    const docsThisMonth = cfg.volume.docsPerMonth * mult.volumeMult * volumeShareAt(cfg.ramp, month);
    const accuracy = accuracyAt(accuracyBase, cfg.ramp, month) * (accuracyBase > 0 ? mult.accuracyMult : 1);
    const accuracyClamped = clamp(accuracy, 0, 0.999);

    const tco = costFn(cfg, month, mult, docsThisMonth);
    const benefit = monthlyBenefit(cfg, month, mult, docsThisMonth, accuracyClamped, captureRatePct);
    const oldProcessCostIDR = month <= cfg.ramp.parallelRunMonths ? cfg.oldProcessMonthlyCostIDR : 0;

    const netCashFlowIDR = benefit.totalIDR - tco.totalIDR - oldProcessCostIDR;
    cumulative += netCashFlowIDR;
    npvIDR += netCashFlowIDR / Math.pow(1 + monthlyDiscountRate, month);

    monthly.push({
      month,
      docsProcessed: docsThisMonth,
      tco,
      benefit,
      oldProcessCostIDR,
      netCashFlowIDR,
      cumulativeCashFlowIDR: cumulative,
    });
  }

  const paybackMonth = computePaybackMonth(monthly);
  const totalBenefitIDR = monthly.reduce((s, r) => s + r.benefit.totalIDR, 0);
  const totalCostIDR = monthly.reduce((s, r) => s + r.tco.totalIDR + r.oldProcessCostIDR, 0);

  return {
    monthly,
    paybackMonth,
    npvIDR,
    totalBenefitIDR,
    totalCostIDR,
    avgMonthlyTco: sumTco(monthly.map((r) => r.tco)),
    avgMonthlyBenefit: sumBenefit(monthly.map((r) => r.benefit)),
  };
}

/** First fractional month where cumulative cash flow crosses from negative to >=0. */
function computePaybackMonth(monthly: MonthRow[]): number | null {
  for (let i = 0; i < monthly.length; i++) {
    if (monthly[i].cumulativeCashFlowIDR >= 0) {
      const prevCumulative = i === 0 ? 0 : monthly[i - 1].cumulativeCashFlowIDR;
      const delta = monthly[i].cumulativeCashFlowIDR - prevCumulative;
      const fractionalMonth = delta !== 0 ? (0 - prevCumulative) / delta : 0;
      return Math.round((monthly[i].month - 1 + clamp(fractionalMonth, 0, 1)) * 10) / 10;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sensitivity — perturb the 5 spec-called-out uncertain inputs by ±20% one at
// a time (holding the rest at base) and report which single input moves
// payback the most.
// ---------------------------------------------------------------------------

const SENSITIVITY_INPUTS: Array<{ key: keyof ScenarioMultipliers; label: string; direction: 1 | -1 }> = [
  { key: 'tokensPerDocMult', label: 'tokens/doc (inference sizing)', direction: 1 },
  { key: 'accuracyMult', label: 'model accuracy', direction: -1 }, // a drop in accuracy is the "bad" direction
  { key: 'captureRateMult', label: 'leakage capture rate', direction: -1 },
  { key: 'buildCostMult', label: 'one-time build cost', direction: 1 },
  { key: 'volumeMult', label: 'document volume', direction: -1 },
];

// A config with no payback within the horizon still needs a finite number to
// rank against — penalize it as if payback landed 3 months past the horizon.
const NO_PAYBACK_PENALTY_MONTHS = 3;

function paybackOrPenalty(summary: OptionSummary, horizonMonths: number): number {
  return summary.paybackMonth ?? horizonMonths + NO_PAYBACK_PENALTY_MONTHS;
}

function computeSensitivity(cfg: RoiEngineConfig): RoiEngineResult['sensitivity'] {
  const base = SCENARIO_MULTIPLIERS.base;
  const baseResult = runOption(cfg, base, aiMonthlyTco, cfg.benefit.accuracyRate, cfg.benefit.modelCaptureRatePct);
  const basePayback = paybackOrPenalty(baseResult, cfg.horizonMonths);

  let worst = { inputKey: SENSITIVITY_INPUTS[0].key, label: SENSITIVITY_INPUTS[0].label, paybackSwing: 0, npvSwing: 0 };

  for (const input of SENSITIVITY_INPUTS) {
    const perturbedMult: ScenarioMultipliers = { ...base, [input.key]: base[input.key] * (1 + 0.2 * input.direction) };
    const perturbedResult = runOption(cfg, perturbedMult, aiMonthlyTco, cfg.benefit.accuracyRate, cfg.benefit.modelCaptureRatePct);
    const perturbedPayback = paybackOrPenalty(perturbedResult, cfg.horizonMonths);

    const paybackSwing = Math.abs(perturbedPayback - basePayback);
    const npvSwing = Math.abs(perturbedResult.npvIDR - baseResult.npvIDR);

    if (paybackSwing > worst.paybackSwing || (paybackSwing === worst.paybackSwing && npvSwing > worst.npvSwing)) {
      worst = { inputKey: input.key, label: input.label, paybackSwing, npvSwing };
    }
  }

  const swingMonthsLabel = worst.paybackSwing >= 0.1 ? `${worst.paybackSwing.toFixed(1)} months` : 'a fraction of a month';
  const npvLabel = `Rp ${Math.round(worst.npvSwing).toLocaleString('id-ID')}`;

  return {
    inputKey: worst.inputKey,
    inputLabel: worst.label,
    paybackSwingMonths: worst.paybackSwing,
    npvSwingIDR: worst.npvSwing,
    summary: `Payback is most sensitive to ${worst.label} — a ±20% swing shifts payback by ${swingMonthsLabel} (NPV swings by ${npvLabel}).`,
  };
}

// ---------------------------------------------------------------------------
// "How much to build and run this" — a simple, decoupled answer. No ramp, no
// discounting, no scenario multipliers: just the one-time build cost and the
// monthly/annual run cost once the process is fully live. This exists
// because payback/NPV answer "is this worth doing", not "what does it cost
// us" — leadership usually wants that second, much simpler question
// answered on its own, without wading through 20 assumption fields to get it.
// ---------------------------------------------------------------------------

function computeBuildAndRunCost(cfg: RoiEngineConfig): BuildRunCostSummary {
  const base = SCENARIO_MULTIPLIERS.base;
  // Full volume, month 1, with amortization/ramp switched off by asking for
  // the steady-state shape directly rather than reading it off any specific
  // ramped month.
  const docsAtFullVolume = cfg.volume.docsPerMonth;
  const steadyState = aiMonthlyTco(cfg, cfg.ops.amortizationMonths + 1, base, docsAtFullVolume); // month past amortization => buildCostAmortizedIDR is 0

  const monthlyRunCost = {
    inferenceCostIDR: steadyState.inferenceCostIDR,
    laborCostIDR: steadyState.laborCostIDR,
    maintenanceCostIDR: steadyState.maintenanceCostIDR,
    infraCostIDR: steadyState.infraCostIDR,
    complianceCostIDR: steadyState.complianceCostIDR,
    totalIDR: steadyState.totalIDR, // buildCostAmortizedIDR is 0 here, so this is pure run cost
  };

  return {
    oneTimeBuildCostIDR: cfg.ops.buildCostIDR,
    monthlyRunCost,
    annualRunCostIDR: monthlyRunCost.totalIDR * 12,
  };
}

// ---------------------------------------------------------------------------
// Man-hours saved — its own calculation, on purpose. See the comment on
// ManHoursSavedSummary and the softCapacityValueIDR note in monthlyBenefit().
// ---------------------------------------------------------------------------

function computeManHoursSaved(cfg: RoiEngineConfig): ManHoursSavedSummary {
  const { benefit } = cfg;
  const hoursPerMonth = benefit.softCapacityHoursPerMonth; // full realization — this is the steady-state figure, not ramped
  const redeployedValueMonthlyIDR = hoursPerMonth * benefit.redeploymentFactor * benefit.softCapacityHourlyValueIDR;
  return {
    hoursPerMonth,
    hoursPerYear: hoursPerMonth * 12,
    redeploymentFactor: benefit.redeploymentFactor,
    redeployedValueMonthlyIDR,
    redeployedValueAnnualIDR: redeployedValueMonthlyIDR * 12,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function runRoiTcoEngine(cfg: RoiEngineConfig): RoiEngineResult {
  const scenarios = {} as Record<ScenarioName, OptionSummary>;
  (Object.keys(SCENARIO_MULTIPLIERS) as ScenarioName[]).forEach((name) => {
    scenarios[name] = runOption(cfg, SCENARIO_MULTIPLIERS[name], aiMonthlyTco, cfg.benefit.accuracyRate, cfg.benefit.modelCaptureRatePct);
  });

  const base = SCENARIO_MULTIPLIERS.base;
  const rpaOnly = runOption(cfg, base, rpaMonthlyTco, cfg.rpa.accuracyRate, cfg.rpa.leakageCaptureRatePct);
  const hybrid = runOption(cfg, base, hybridMonthlyTco, cfg.benefit.accuracyRate, cfg.benefit.modelCaptureRatePct);

  return {
    scenarios,
    rpaOnly,
    hybrid,
    buildAndRunCost: computeBuildAndRunCost(cfg),
    manHoursSaved: computeManHoursSaved(cfg),
    sensitivity: computeSensitivity(cfg),
  };
}

// ---------------------------------------------------------------------------
// Volume tiers — shared with the existing 1-5 volumeRating scale used
// elsewhere in the app (server.ts's /api/ai/propose-deployment estimator) so
// a process's catalogue rating maps to the same docs/month figure everywhere.
// ---------------------------------------------------------------------------

export function estimateMonthlyVolumeFromRating(volumeRating: number | undefined): number {
  const vol = volumeRating || 3;
  if (vol <= 1) return 100;
  if (vol === 2) return 300;
  if (vol === 3) return 1000;
  if (vol === 4) return 3500;
  return 10000;
}
