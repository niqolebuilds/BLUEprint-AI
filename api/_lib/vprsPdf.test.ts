/**
 * Proves buildVprsSpec() always produces a spec the vendored renderer's own
 * AJV schema accepts — across the solution-type branches, with and without
 * gaps/decision points/systems, since those toggle which optional spec
 * sections get emitted at all (see the "nothing is a placeholder" comments
 * in buildVprsSpec()). Does NOT exercise the PDF/Chromium stage — that's
 * covered by vprs-pdf/test/render.test.js (32 assertions, run via
 * `cd vprs-pdf && npm test`) and was hand-verified against the exact
 * serverless Chromium pairing this ships with (see vprsPdf.ts's top comment).
 */
import { describe, it, expect } from 'vitest';
import { buildVprsSpec, GenerateVprsPdfPackInput } from './vprsPdf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as vprsPdfLib from '../../vprs-pdf/src/index.js';

const { validateSpec, applyDefaults } = vprsPdfLib as {
  validateSpec: (spec: unknown) => { valid: boolean; errors: string[] };
  applyDefaults: (spec: unknown) => unknown;
};

function baseInput(overrides: Partial<GenerateVprsPdfPackInput> = {}): GenerateVprsPdfPackInput {
  return {
    proc: {
      id: 'proc-ap-invoice-01',
      title: 'Vendor Invoice 3-Way Match',
      description: 'Matches vendor invoices against PO and GRN before posting to the ERP.',
      subFunction: 'Transactional Accounting',
      ownerName: 'Nicole Wangga',
      status: 'Approved',
      category: 'Accounts Payable',
      problemStatement: 'AP officers manually reconcile invoices against PO/GRN in Excel, taking 3 days per cycle.',
      aiOpportunity: 'An agent can extract line items and propose matches. A human reviewer approves before posting.',
      completenessScore: 92,
      gaps: ['No automated 3-way match today.', 'Exceptions are tracked in a shared spreadsheet.'],
      steps: [
        {
          name: 'Receive vendor invoice',
          description: 'Invoice PDF arrives via email intake.',
          systems: ['Email', 'Microsoft Dynamics 365 (ERP)'],
          outputs: ['Digitised invoice record'],
          decisionPoints: ['Is the invoice a duplicate?'],
          aiClassification: 'automation',
        },
        {
          name: 'Extract and match line items',
          description: 'Agent extracts line items and matches against PO/GRN.',
          systems: ['Microsoft Dynamics 365 (ERP)'],
          outputs: ['Matched line items with confidence score'],
          decisionPoints: ['Does the match confidence exceed the auto-approve threshold?'],
          aiClassification: 'agentic-ai',
        },
        {
          name: 'Supervisor review',
          description: 'AP supervisor reviews low-confidence matches.',
          systems: ['Microsoft Dynamics 365 (ERP)'],
          outputs: ['Approved AP voucher'],
          aiClassification: 'human-in-the-loop',
        },
      ],
    },
    plan: {
      recommendedSolutionType: 'Agentic AI',
      deploymentSteps: [
        {
          phase: 'Phase 1: Preparation & System Integration',
          title: 'Connect to ERP',
          description: 'Set up API credentials and data schema mapping.',
          systemsInvolved: ['Microsoft Dynamics 365 (ERP)'],
          actionItems: ['Provision service account', 'Map PO/GRN/Invoice schemas'],
        },
        {
          phase: 'Phase 2: Pipeline / Logic Setup',
          title: 'Build the matching agent',
          description: 'Implement extraction and matching logic.',
          systemsInvolved: ['Microsoft Dynamics 365 (ERP)'],
          actionItems: ['Build extraction prompt', 'Build matching logic'],
        },
      ],
      costBenefitAnalysis: {
        estimatedDevelopmentHours: 120,
        developmentCostUSD: 3000,
        annualSubscriptionCostUSD: 1200,
        estimatedAnnualSavingsUSD: 24000,
        paybackPeriodMonths: 4,
        roiPercent: 180,
        manualHoursReducedPerMonth: 60,
      },
      additionalSubscriptions: [{ toolName: 'Gemini Flash API', monthlyCostUSD: 40, linkedKeyActivity: 'Line-item extraction' }],
    },
    ...overrides,
  };
}

function expectValid(spec: Record<string, unknown>) {
  const merged = applyDefaults(spec);
  const { valid, errors } = validateSpec(merged);
  if (!valid) {
    throw new Error(`Spec failed schema validation:\n- ${errors.join('\n- ')}\n\nSpec:\n${JSON.stringify(spec, null, 2)}`);
  }
  expect(valid).toBe(true);
}

describe('buildVprsSpec', () => {
  it('produces a schema-valid spec for the common case (Agentic AI, gaps, decision points, systems)', () => {
    expectValid(buildVprsSpec(baseInput()));
  });

  it('maps each recommendedSolutionType to a valid enum value', () => {
    for (const rec of ['RPA / Automation', 'Agentic AI', 'Hybrid System'] as const) {
      const spec = buildVprsSpec(baseInput({ plan: { ...baseInput().plan, recommendedSolutionType: rec } }));
      expectValid(spec);
      const meta = spec.meta as { solutionType: string };
      expect(['Accounting / Finance Automation', 'AI / Agentic AI', 'RPA Bot', 'Application / Dashboard', 'Integration / API']).toContain(
        meta.solutionType
      );
    }
  });

  it('is still valid when the process has no gaps, no decision points, and no systems', () => {
    const input = baseInput();
    input.proc.gaps = [];
    input.proc.steps = input.proc.steps.map((s) => ({ ...s, systems: [], decisionPoints: [] }));
    const spec = buildVprsSpec(input);
    expectValid(spec);
    // Sections with nothing to say must be omitted, not emitted empty/placeholder.
    expect(spec.systems).toBeUndefined();
    expect((spec.requirements as { business?: unknown[] }).business).toBeUndefined();
    expect(spec.exceptions).toBeUndefined();
  });

  it('is still valid for a process with zero steps', () => {
    const input = baseInput();
    input.proc.steps = [];
    const spec = buildVprsSpec(input);
    expectValid(spec);
    expect(spec.scope).toBeUndefined();
  });

  it('every functional requirement is referenced by exactly one acceptance criterion', () => {
    const spec = buildVprsSpec(baseInput());
    const functional = (spec.requirements as { functional: { id: string }[] }).functional;
    const testing = spec.testing as { requirementRef: string }[];
    expect(testing).toHaveLength(functional.length);
    expect(testing.map((t) => t.requirementRef).sort()).toEqual(functional.map((f) => f.id).sort());
  });

  it('never fabricates integration protocol/frequency it does not know', () => {
    const spec = buildVprsSpec(baseInput());
    const integrations = (spec.systems as { integrations: { protocol: string; frequency: string }[] }).integrations;
    for (const i of integrations) {
      expect(i.protocol).toMatch(/konfirmasi/i);
      expect(i.frequency).toMatch(/konfirmasi/i);
    }
  });

  it('the roadmap is a direct, lossless mapping of the deployment plan phases', () => {
    const input = baseInput();
    const spec = buildVprsSpec(input);
    const roadmap = spec.roadmap as { id: string; phase: string; actions: string[] }[];
    expect(roadmap).toHaveLength(input.plan.deploymentSteps.length);
    expect(roadmap[0].phase).toBe(input.plan.deploymentSteps[0].phase);
    expect(roadmap[0].actions).toEqual(input.plan.deploymentSteps[0].actionItems);
  });
});
