/**
 * Regression coverage for the reported "locked options that makes it
 * inaccurate" bug: a process whose sub-function doesn't match any of the
 * five finance presets used to silently get the AP-invoice preset's numbers
 * (page counts, review minutes, accuracy, cost-per-error) with no
 * indication that had happened. suggestTemplateForSubFunction() must now
 * report the mismatch instead of hiding it.
 */
import { describe, it, expect } from 'vitest';
import { FINANCE_PROCESS_TEMPLATES, CUSTOM_TEMPLATE, ALL_FINANCE_TEMPLATES, suggestTemplateForSubFunction } from './financeProcessTemplates';

describe('suggestTemplateForSubFunction', () => {
  it('matches a sub-function covered by a preset', () => {
    const result = suggestTemplateForSubFunction('Tax Management');
    expect(result.matched).toBe(true);
    expect(result.template.key).toBe('tax_compliance_docs');
  });

  it('falls back to the neutral CUSTOM_TEMPLATE — and reports the mismatch — for a sub-function no preset covers', () => {
    // Internal Audit, Investment, Revenue Assurance etc. have no preset at
    // all in FINANCE_PROCESS_TEMPLATES — this used to silently return
    // FINANCE_PROCESS_TEMPLATES[0] (AP invoice processing).
    const result = suggestTemplateForSubFunction('Internal Audit');
    expect(result.matched).toBe(false);
    expect(result.template.key).toBe('custom');
    expect(result.template).toBe(CUSTOM_TEMPLATE);
  });

  it('is case-insensitive on the match', () => {
    const result = suggestTemplateForSubFunction('tax management');
    expect(result.matched).toBe(true);
  });
});

describe('CUSTOM_TEMPLATE', () => {
  it('is included in the selectable list, after the five real presets', () => {
    expect(ALL_FINANCE_TEMPLATES).toHaveLength(FINANCE_PROCESS_TEMPLATES.length + 1);
    expect(ALL_FINANCE_TEMPLATES.at(-1)!.key).toBe('custom');
  });

  it('carries neutral, non-preset-specific defaults', () => {
    // Not asserting exact values (those may reasonably tune over time) — just
    // that it's a real, usable RoiEngineConfig input shape, not a stub.
    expect(CUSTOM_TEMPLATE.defaultAccuracyRate).toBeGreaterThan(0);
    expect(CUSTOM_TEMPLATE.defaultAccuracyRate).toBeLessThanOrEqual(1);
    expect(CUSTOM_TEMPLATE.defaultCostPerErrorIDR).toBeGreaterThan(0);
    expect(CUSTOM_TEMPLATE.suggestedSubFunctions).toEqual([]);
  });
});
