/**
 * Run with: npm test (vitest run — picks up every *.test.ts file per vitest.config.ts)
 *
 * These assertions exist to keep the engine honest as it evolves — they
 * encode the four non-negotiable properties called out when this engine was
 * commissioned: token cost is not TCO, soft savings don't leak into hard
 * payback, a longer parallel run makes payback slower (never faster), and
 * the engine is genuinely config-driven rather than hardcoded to one process.
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { runRoiTcoEngine, resolveScenarioMultipliers, DEFAULT_SCENARIO_MULTIPLIERS, RoiEngineConfig } from './roiTcoEngine';
import { buildDefaultConfig } from './roiTcoDefaults';
import { FINANCE_PROCESS_TEMPLATES } from '../data/financeProcessTemplates';

function apInvoiceConfig(overrides: Partial<Parameters<typeof buildDefaultConfig>[0]['overrides']> = {}): RoiEngineConfig {
  const template = FINANCE_PROCESS_TEMPLATES.find((t) => t.key === 'ap_invoice_processing')!;
  return buildDefaultConfig({
    template,
    docsPerMonth: 3500,
    oldProcessMonthlyCostIDR: 45_000_000,
    overrides: {
      benefit: {
        hardCashSavingsMonthlyIDR: 80_000_000,
        addressableLeakageMonthlyIDR: 40_000_000,
      },
      ...overrides,
    },
  });
}

test('token/inference cost alone is never treated as the total cost of ownership', () => {
  const result = runRoiTcoEngine(apInvoiceConfig());
  const steadyStateMonth = result.scenarios.base.monthly.at(-1)!; // last month = fully ramped, no more one-time build cost
  const inferenceOnly = steadyStateMonth.tco.inferenceCostIDR;
  const fullTco = steadyStateMonth.tco.totalIDR;

  assert.ok(fullTco > inferenceOnly, 'TCO must exceed raw inference/token cost once labor, maintenance, infra, and compliance are included');
  // Every non-inference bucket must be present and non-zero — otherwise we've silently collapsed back to "token cost == TCO".
  assert.ok(steadyStateMonth.tco.laborCostIDR > 0, 'human review labor must be part of TCO');
  assert.ok(steadyStateMonth.tco.maintenanceCostIDR > 0, 'maintenance must be part of TCO');
  assert.ok(steadyStateMonth.tco.infraCostIDR > 0, 'infra must be part of TCO');
  assert.ok(steadyStateMonth.tco.complianceCostIDR > 0, 'compliance must be part of TCO');
});

test('soft capacity savings are excluded from the hard-cash payback unless redeployed', () => {
  const withoutRedeployment = apInvoiceConfig({
    benefit: {
      hardCashSavingsMonthlyIDR: 20_000_000,
      addressableLeakageMonthlyIDR: 15_000_000,
      softCapacityHoursPerMonth: 400, // a lot of hours freed...
      redeploymentFactor: 0, // ...but none of it converts to real capacity
    },
  });
  const zeroHours = apInvoiceConfig({
    benefit: {
      hardCashSavingsMonthlyIDR: 20_000_000,
      addressableLeakageMonthlyIDR: 15_000_000,
      softCapacityHoursPerMonth: 0,
      redeploymentFactor: 0,
    },
  });

  const a = runRoiTcoEngine(withoutRedeployment).scenarios.base;
  const b = runRoiTcoEngine(zeroHours).scenarios.base;

  assert.equal(a.paybackMonth, b.paybackMonth, 'unredeployed soft hours must not move payback at all');
  assert.equal(a.avgMonthlyBenefit.totalIDR, b.avgMonthlyBenefit.totalIDR, 'unredeployed soft hours must not move benefit totals');

  const withRedeployment = apInvoiceConfig({
    benefit: {
      hardCashSavingsMonthlyIDR: 20_000_000,
      addressableLeakageMonthlyIDR: 15_000_000,
      softCapacityHoursPerMonth: 400,
      redeploymentFactor: 0.4,
    },
  });
  const c = runRoiTcoEngine(withRedeployment).scenarios.base;
  assert.ok(
    c.avgMonthlyBenefit.softCapacityValueIDR > a.avgMonthlyBenefit.softCapacityValueIDR,
    'redeployed soft hours must show up as benefit once redeploymentFactor > 0'
  );
});

test('payback lengthens as the parallel-run window grows', () => {
  const shortParallel = apInvoiceConfig({ ramp: { pilotMonths: 2, pilotVolumeSharePct: 0.3, pilotAccuracyPenaltyPct: 0.05, parallelRunMonths: 1, benefitRampMonths: 4 } });
  const longParallel = apInvoiceConfig({ ramp: { pilotMonths: 2, pilotVolumeSharePct: 0.3, pilotAccuracyPenaltyPct: 0.05, parallelRunMonths: 9, benefitRampMonths: 4 } });

  const short = runRoiTcoEngine(shortParallel).scenarios.base;
  const long = runRoiTcoEngine(longParallel).scenarios.base;

  assert.ok(short.paybackMonth !== null && long.paybackMonth !== null, 'both configs must reach payback within the horizon for this assertion to be meaningful');
  assert.ok(long.paybackMonth! > short.paybackMonth!, `payback should lengthen when the parallel-run window grows (got short=${short.paybackMonth}, long=${long.paybackMonth})`);
});

test('the engine runs for at least two different configured processes with no code changes — config only', () => {
  const apInvoice = FINANCE_PROCESS_TEMPLATES.find((t) => t.key === 'ap_invoice_processing')!;
  const monthEndClose = FINANCE_PROCESS_TEMPLATES.find((t) => t.key === 'month_end_close_support')!;

  const configA = buildDefaultConfig({ template: apInvoice, docsPerMonth: 3500, oldProcessMonthlyCostIDR: 45_000_000 });
  const configB = buildDefaultConfig({ template: monthEndClose, docsPerMonth: 250, oldProcessMonthlyCostIDR: 60_000_000 });

  const resultA = runRoiTcoEngine(configA);
  const resultB = runRoiTcoEngine(configB);

  for (const [cfg, result] of [
    [configA, resultA],
    [configB, resultB],
  ] as const) {
    assert.equal(result.scenarios.base.monthly.length, cfg.horizonMonths);
    assert.ok(Number.isFinite(result.scenarios.base.npvIDR), 'NPV must be a finite number');
    assert.ok(result.scenarios.base.avgMonthlyTco.totalIDR > 0, 'TCO must be positive for a running process');
    assert.ok(result.sensitivity.summary.length > 0, 'sensitivity summary must be produced');
    assert.ok(result.rpaOnly.avgMonthlyTco.totalIDR > 0, 'RPA comparison must be produced');
    assert.ok(result.hybrid.avgMonthlyTco.totalIDR > 0, 'hybrid comparison must be produced');
  }

  // The two runs must actually differ — proof this isn't secretly hardcoded to one process.
  assert.notEqual(resultA.scenarios.base.avgMonthlyTco.totalIDR, resultB.scenarios.base.avgMonthlyTco.totalIDR);

  // A brand-new template (still just config, zero engine/UI code changes) must also run cleanly.
  for (const template of FINANCE_PROCESS_TEMPLATES) {
    const cfg = buildDefaultConfig({ template, docsPerMonth: 500, oldProcessMonthlyCostIDR: 30_000_000 });
    assert.doesNotThrow(() => runRoiTcoEngine(cfg), `engine must run for template "${template.key}" without code changes`);
  }
});

test('scenarios are ordered downside <= base <= upside on net benefit', () => {
  const result = runRoiTcoEngine(apInvoiceConfig());
  assert.ok(result.scenarios.downside.totalBenefitIDR - result.scenarios.downside.totalCostIDR <= result.scenarios.base.totalBenefitIDR - result.scenarios.base.totalCostIDR + 1);
  assert.ok(result.scenarios.base.totalBenefitIDR - result.scenarios.base.totalCostIDR <= result.scenarios.upside.totalBenefitIDR - result.scenarios.upside.totalCostIDR + 1);
});

// --- Regression coverage for the reported bug: "the calculator isn't
// responding when a number is typed in." Root cause: oldProcessMonthlyCostIDR
// was only ever charged as a temporary parallel-run cost and never converted
// into an avoided-cost benefit once the old process was decommissioned, so
// raising it barely moved payback/NPV and never moved "Total benefit" at all.

test('a higher old-process cost strictly improves benefit once the parallel run ends (the reported bug)', () => {
  const cheap = apInvoiceConfig({ }); // oldProcessMonthlyCostIDR = 45,000,000 by default in apInvoiceConfig
  const expensive = { ...cheap, oldProcessMonthlyCostIDR: 200_000_000 };

  const cheapResult = runOptionForTest(cheap);
  const expensiveResult = runOptionForTest(expensive);

  const afterParallelRun = cheap.ramp.parallelRunMonths + 1;
  const cheapMonth = cheapResult.monthly[afterParallelRun - 1];
  const expensiveMonth = expensiveResult.monthly[afterParallelRun - 1];

  assert.ok(
    expensiveMonth.benefit.avoidedOldProcessCostIDR > cheapMonth.benefit.avoidedOldProcessCostIDR,
    'a bigger old-process cost must show up as a bigger avoided-cost benefit after decommissioning'
  );
  assert.ok(
    expensiveMonth.benefit.totalIDR > cheapMonth.benefit.totalIDR,
    'the higher old-process cost must actually move "Total benefit/mo", not just NPV'
  );
  assert.ok(expensiveResult.npvIDR > cheapResult.npvIDR, 'NPV must improve, not worsen, when the avoided cost is bigger');
});

test('during the parallel run, old-process cost is charged but not yet counted as avoided (both apply at once)', () => {
  const cfg = apInvoiceConfig();
  const result = runOptionForTest(cfg);
  const duringParallelRun = result.monthly[0]; // month 1 <= parallelRunMonths (3 by default)

  assert.equal(duringParallelRun.benefit.avoidedOldProcessCostIDR, 0, 'nothing is avoided yet while still running in parallel');
  assert.ok(duringParallelRun.oldProcessCostIDR > 0, 'the old process is still being paid for during the parallel run');
});

function runOptionForTest(cfg: RoiEngineConfig) {
  return runRoiTcoEngine(cfg).scenarios.base;
}

test('man-hours saved is reported as its own figure, decoupled from the cash-driven benefit total', () => {
  const withHours = apInvoiceConfig({
    benefit: {
      hardCashSavingsMonthlyIDR: 0,
      addressableLeakageMonthlyIDR: 0,
      softCapacityHoursPerMonth: 300,
      redeploymentFactor: 0.4,
    },
  });
  const withoutHours = apInvoiceConfig({
    benefit: {
      hardCashSavingsMonthlyIDR: 0,
      addressableLeakageMonthlyIDR: 0,
      softCapacityHoursPerMonth: 0,
      redeploymentFactor: 0.4,
    },
  });

  const a = runRoiTcoEngine(withHours);
  const b = runRoiTcoEngine(withoutHours);

  assert.equal(a.manHoursSaved.hoursPerMonth, 300);
  assert.equal(a.manHoursSaved.hoursPerYear, 3600);
  assert.ok(a.manHoursSaved.redeployedValueMonthlyIDR > 0);

  // The whole point: 300 freed hours must NOT change the cash-driven payback total.
  assert.equal(
    a.scenarios.base.avgMonthlyBenefit.totalIDR,
    b.scenarios.base.avgMonthlyBenefit.totalIDR,
    'man-hours saved must not leak into the cash-driven benefit total'
  );
});

test('cost to build & maintain is a simple, un-ramped, un-discounted figure', () => {
  const cfg = apInvoiceConfig();
  const result = runRoiTcoEngine(cfg);

  assert.equal(result.buildAndRunCost.oneTimeBuildCostIDR, cfg.ops.buildCostIDR);
  assert.ok(result.buildAndRunCost.monthlyRunCost.totalIDR > 0, 'steady-state run cost must be positive');
  assert.equal(
    Math.round(result.buildAndRunCost.annualRunCostIDR),
    Math.round(result.buildAndRunCost.monthlyRunCost.totalIDR * 12),
    'annual run cost must be exactly 12x the monthly run cost — no ramp/discounting involved'
  );
  // Doubling docs/month should raise the run cost (inference + labor scale with volume).
  const doubledVolume = { ...cfg, volume: { ...cfg.volume, docsPerMonth: cfg.volume.docsPerMonth * 2 } };
  const doubledResult = runRoiTcoEngine(doubledVolume);
  assert.ok(doubledResult.buildAndRunCost.monthlyRunCost.totalIDR > result.buildAndRunCost.monthlyRunCost.totalIDR);
});

// --- Regression coverage for the reported bug: "no matter how I fill in the
// table, the scenarios are static." Root cause: SCENARIO_MULTIPLIERS (what
// actually makes Downside/Upside diverge from Base) was a hardcoded module
// constant with no config field and no UI control at all — every other
// assumption in this engine was user-editable, but not this one, so the
// scenario spread genuinely never responded to any input, no matter which
// field was changed.

test('resolveScenarioMultipliers falls back to the fixed defaults when a config sets no scenarioAdjustments', () => {
  const cfg = apInvoiceConfig();
  assert.deepEqual(resolveScenarioMultipliers(cfg, 'downside'), DEFAULT_SCENARIO_MULTIPLIERS.downside);
  assert.deepEqual(resolveScenarioMultipliers(cfg, 'upside'), DEFAULT_SCENARIO_MULTIPLIERS.upside);
  assert.deepEqual(resolveScenarioMultipliers(cfg, 'base'), DEFAULT_SCENARIO_MULTIPLIERS.base);
});

test('base is never overridable, even if a config tries to set one', () => {
  const cfg: RoiEngineConfig = {
    ...apInvoiceConfig(),
    // @ts-expect-error — 'base' is intentionally excluded from the overridable key type
    scenarioAdjustments: { base: { tokensPerDocMult: 5 } },
  };
  assert.deepEqual(resolveScenarioMultipliers(cfg, 'base'), DEFAULT_SCENARIO_MULTIPLIERS.base);
});

test('overriding the Downside/Upside spread actually changes those scenarios — the reported bug, fixed', () => {
  const baseline = apInvoiceConfig();
  const baselineResult = runRoiTcoEngine(baseline);

  // A config-level override, exactly as buildDefaultConfig's downsideAdjustment/
  // upsideAdjustment overrides produce, making Downside dramatically worse and
  // Upside dramatically better than the fixed defaults.
  const adjusted: RoiEngineConfig = {
    ...baseline,
    scenarioAdjustments: {
      downside: { tokensPerDocMult: 3, accuracyMult: 0.5, captureRateMult: 0.2, buildCostMult: 3, volumeMult: 0.5 },
      upside: { tokensPerDocMult: 0.3, accuracyMult: 1.05, captureRateMult: 2, buildCostMult: 0.3, volumeMult: 2 },
    },
  };
  const adjustedResult = runRoiTcoEngine(adjusted);

  assert.notEqual(
    adjustedResult.scenarios.downside.avgMonthlyTco.totalIDR,
    baselineResult.scenarios.downside.avgMonthlyTco.totalIDR,
    'a Downside spread override must change the Downside scenario'
  );
  assert.notEqual(
    adjustedResult.scenarios.upside.avgMonthlyTco.totalIDR,
    baselineResult.scenarios.upside.avgMonthlyTco.totalIDR,
    'an Upside spread override must change the Upside scenario'
  );
  // Base is defined as "no adjustment" — it must be untouched by either override.
  assert.deepEqual(adjustedResult.scenarios.base, baselineResult.scenarios.base);

  // The wider spread must actually widen the gap between the scenarios, not
  // just move all three in lockstep.
  const baselineSpread = baselineResult.scenarios.upside.npvIDR - baselineResult.scenarios.downside.npvIDR;
  const adjustedSpread = adjustedResult.scenarios.upside.npvIDR - adjustedResult.scenarios.downside.npvIDR;
  assert.ok(adjustedSpread > baselineSpread, 'a wider configured spread must produce a wider NPV gap between Downside and Upside');
});

test('a partial scenario override only changes the dimensions it specifies, leaving the rest at default', () => {
  const cfg: RoiEngineConfig = {
    ...apInvoiceConfig(),
    scenarioAdjustments: { downside: { volumeMult: 0.5 } }, // only volume overridden
  };
  const resolved = resolveScenarioMultipliers(cfg, 'downside');
  assert.equal(resolved.volumeMult, 0.5);
  assert.equal(resolved.tokensPerDocMult, DEFAULT_SCENARIO_MULTIPLIERS.downside.tokensPerDocMult);
  assert.equal(resolved.accuracyMult, DEFAULT_SCENARIO_MULTIPLIERS.downside.accuracyMult);
});
