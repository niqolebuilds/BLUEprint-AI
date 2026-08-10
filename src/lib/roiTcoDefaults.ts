/**
 * Builds a default RoiEngineConfig by wiring the shared pricing table
 * (src/data/pricingStandards.ts) and a selected finance process template
 * (src/data/financeProcessTemplates.ts) into the engine's input shape.
 *
 * Kept separate from roiTcoEngine.ts on purpose: the engine stays a pure
 * function of its config and never imports app data modules, so it is easy
 * to unit test and to reuse from server.ts without pulling in the data layer
 * twice.
 */

import { findPricingRate, DEFAULT_FX_IDR_PER_USD } from '../data/pricingStandards';
import { FinanceProcessTemplate } from '../data/financeProcessTemplates';
import { RoiEngineConfig } from './roiTcoEngine';

export interface BuildConfigOptions {
  template: FinanceProcessTemplate;
  docsPerMonth: number;
  /** Use Gemini Pro instead of Flash for the inference rate assumptions. */
  useProModel?: boolean;
  /** Monthly cost of the manual/legacy process being replaced — the single input this engine cannot infer on its own. */
  oldProcessMonthlyCostIDR: number;
  horizonMonths?: number;
  discountRateAnnualPct?: number;
  /** Deep-mergeable overrides for any assumption group — every input stays user-editable. */
  overrides?: Partial<{
    volume: Partial<RoiEngineConfig['volume']>;
    inference: Partial<RoiEngineConfig['inference']>;
    labor: Partial<RoiEngineConfig['labor']>;
    ops: Partial<RoiEngineConfig['ops']>;
    benefit: Partial<RoiEngineConfig['benefit']>;
    ramp: Partial<RoiEngineConfig['ramp']>;
    rpa: Partial<RoiEngineConfig['rpa']>;
  }>;
}

export function buildDefaultConfig(opts: BuildConfigOptions): RoiEngineConfig {
  const fx = DEFAULT_FX_IDR_PER_USD;
  const t = opts.template;
  const o = opts.overrides ?? {};

  const config: RoiEngineConfig = {
    processLabel: t.label,
    horizonMonths: opts.horizonMonths ?? 24,
    fxIdrPerUsd: fx,
    discountRateAnnualPct: opts.discountRateAnnualPct ?? 0.12, // typical corporate hurdle rate for an internal automation initiative
    oldProcessMonthlyCostIDR: opts.oldProcessMonthlyCostIDR,

    volume: {
      docsPerMonth: opts.docsPerMonth,
      pagesPerDoc: t.defaultPagesPerDoc,
      passesPerDoc: t.defaultPassesPerDoc,
      visionRequired: t.visionRequired,
      ...o.volume,
    },

    inference: {
      promptOverheadTokens: t.defaultPromptOverheadTokens,
      fewShotTokens: t.defaultFewShotTokens,
      tokensPerPage: t.defaultTokensPerPage,
      outputTokensPerDoc: t.defaultOutputTokensPerDoc,
      textInputRateUsdPer1M: findPricingRate(opts.useProModel ? 'gemini_pro_input' : 'gemini_flash_input'),
      outputRateUsdPer1M: findPricingRate(opts.useProModel ? 'gemini_pro_output' : 'gemini_flash_output'),
      visionInputMultiplier: findPricingRate('vision_pdf_token_multiplier'),
      retryRate: t.defaultRetryRate,
      ...o.inference,
    },

    labor: {
      reviewMinutesPerDoc: t.defaultReviewMinutesPerDoc,
      reviewSharePct: t.defaultReviewSharePct,
      loadedHourlyWageIDR: findPricingRate('reviewer_loaded_wage') * fx,
      ...o.labor,
    },

    ops: {
      maintenanceMonthlyIDR: findPricingRate('prompt_maintenance_monthly') * fx,
      infraMonthlyIDR: (findPricingRate('ocr_doc_ai') + findPricingRate('orchestration_platform')) * fx,
      complianceMonthlyIDR: findPricingRate('compliance_audit_monthly') * fx,
      buildCostIDR: findPricingRate('blended_integration_dev_rate') * fx * 160, // ~160 dev-hours default integration effort
      amortizationMonths: 12,
      ...o.ops,
    },

    benefit: {
      hardCashSavingsMonthlyIDR: 0, // no default guess for cash-specific savings — must be entered per process
      softCapacityHoursPerMonth: 0,
      redeploymentFactor: 0.4, // default share of freed hours assumed to convert into real redeployed capacity
      softCapacityHourlyValueIDR: findPricingRate('reviewer_loaded_wage') * fx,
      addressableLeakageMonthlyIDR: 0,
      addressableSharePct: 1,
      modelCaptureRatePct: 0.7,
      accuracyRate: t.defaultAccuracyRate,
      costPerErrorIDR: t.defaultCostPerErrorIDR,
      ...o.benefit,
    },

    ramp: {
      pilotMonths: 2,
      pilotVolumeSharePct: 0.3,
      pilotAccuracyPenaltyPct: 0.05,
      parallelRunMonths: 3,
      benefitRampMonths: 4,
      ...o.ramp,
    },

    rpa: {
      licenseMonthlyIDR: findPricingRate('rpa_runtime_license') * fx,
      botDevCostIDR: findPricingRate('rpa_bot_dev_cost') * fx,
      orchestrationMonthlyIDR: findPricingRate('orchestration_platform') * fx,
      maintenanceMonthlyIDR: findPricingRate('rpa_maintenance_monthly') * fx,
      amortizationMonths: 12,
      exceptionRatePct: 0.15, // rule-based bots break on layout/format variance and route the rest to a human
      accuracyRate: 0.97, // RPA is typically very accurate on the well-structured slice it can handle at all
      leakageCaptureRatePct: 0.3, // RPA cannot read unstructured content, so it captures far less addressable leakage than a model that can
      ...o.rpa,
    },
  };

  return config;
}
