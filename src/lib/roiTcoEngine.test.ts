/**
 * Run with: npm test  (== vitest run — picks up every **/*.test.ts, per vitest.config.ts)
 *
 * These assertions exist to keep the engine honest as it evolves — they
 * encode the four non-negotiable properties called out when this engine was
 * commissioned: token cost is not TCO, soft savings don't leak into hard
 * payback, a longer parallel run makes payback slower (never faster), and
 * the engine is genuinely config-driven rather than hardcoded to one process.
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { runRoiTcoEngine, RoiEngineConfig } from './roiTcoEngine';
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
