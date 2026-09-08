/**
 * Wires the vendored VPRS PDF generator (vprs-pdf/, a self-contained
 * CommonJS package — see vprs-pdf/README.md) into Blueprint AI: maps a
 * catalogue Process + its generated AI Deployment Roadmap into a VPRS spec
 * (vprs-pdf/schema/vprs.schema.json), then runs the spec → Markdown → HTML →
 * PDF pipeline.
 *
 * Kept out of src/ on purpose (same reasoning as api/_lib/prdEngine.ts): this
 * runs server-side only (real Chromium is required for the PDF stage), and
 * api/ + src/ are bundled independently, so this file defines its own narrow
 * input types instead of importing src/types.ts.
 *
 * CHROMIUM: locally, vprs-pdf/src/pdf.js discovers a Chromium under
 * PLAYWRIGHT_BROWSERS_PATH itself — nothing to do here. On Vercel there is no
 * browser in the function image, so resolveServerlessChromium() below
 * supplies one via @sparticuz/chromium-min, which downloads a brotli-packed
 * Chromium from a GitHub Releases URL on cold start (~2.5s, cached in /tmp
 * for the container's lifetime — see resolveServerlessChromium()'s module-
 * level cache below).
 *
 * IMPORTANT — this used to be the full @sparticuz/chromium package, and that
 * was a real bug, not just a suboptimal choice: its own npm tarball is
 * ~70MB, which is already over Vercel's 50MB-COMPRESSED serverless function
 * limit before counting mermaid/playwright-core/ajv/marked/app code. That
 * almost certainly made every deploy of api/vprs-pdf.ts fail at build time —
 * which reads exactly like "redeployed and it's still not there," because a
 * failed function build doesn't update what's live. @sparticuz/chromium-min
 * ships as ~15KB (verified) since it fetches the binary at runtime instead
 * of bundling it — check Vercel's build/function logs for this project's
 * actual deployment to confirm this was really it, but it is the one
 * concrete, verified way this could silently fail to ship.
 *
 * VERSION PINNING: chromium 143.0.4 (not the newest, 149.x) + playwright-core
 * 1.62.1 — both exact versions in package.json, not ranges. Two reasons for
 * 143.0.4 specifically: (1) @sparticuz/chromium(-min) versions from 147.0.0
 * onward require Node >=22.17.0 in their own package.json engines field;
 * 143.0.4 only requires Node >=20.11.0, which is far more likely to match
 * whatever Node runtime this Vercel project is actually configured for —
 * requiring a newer Node than the project runs would be a second, harder-to-
 * diagnose way for this to silently not work. (2) It's still hand-verified:
 * a fresh cold-start download (no warm /tmp cache) of the exact
 * v143.0.4-pack.x64.tar release asset, launched via playwright-core 1.62.1,
 * rendered the vendored tool's full 26-page reference example (mermaid
 * diagram included) correctly. Bump chromium/playwright-core only together,
 * and re-verify both the download URL (github.com/Sparticuz/chromium/releases
 * — filename is `chromium-v<version>-pack.x64.tar`) and the Node engines
 * requirement before moving past 143.x.
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The vendored tool is plain CommonJS (see vprs-pdf/package.json — no "type"
// field, so Node resolves that whole subtree as CommonJS regardless of this
// repo's own "type": "module"). TS resolves it via allowJs; there are no
// .d.ts files, so these come back loosely typed.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as vprsPdfLib from '../../vprs-pdf/src/index.js';

const { generate, validateSpec } = vprsPdfLib as {
  generate: (args: Record<string, unknown>) => Promise<{ pdf?: string; html?: string; markdown?: string; manifest: unknown[] }>;
  validateSpec: (spec: unknown) => { valid: boolean; errors: string[] };
};

/* ============================== Input shapes =============================
   Narrow mirrors of the relevant slices of src/types.ts's Process /
   DeploymentPlan / SystemItem — only the fields the mapper actually reads. */

export interface VprsProcessStepInput {
  id?: string;
  order?: number;
  name: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
  decisionPoints?: string[];
  systems?: string[];
  handOffs?: string[];
  aiClassification?: 'agentic-ai' | 'automation' | 'human-in-the-loop';
}

export interface VprsProcessInput {
  id: string;
  title: string;
  description: string;
  subFunction: string;
  ownerName: string;
  status: string;
  steps: VprsProcessStepInput[];
  completenessScore?: number;
  gaps?: string[];
  category?: string;
  problemStatement?: string;
  aiOpportunity?: string;
}

export interface VprsDeploymentStepInput {
  phase: string;
  title: string;
  description: string;
  systemsInvolved: string[];
  actionItems: string[];
}

export interface VprsDeploymentPlanInput {
  recommendedSolutionType: 'RPA / Automation' | 'Agentic AI' | 'Hybrid System';
  deploymentSteps: VprsDeploymentStepInput[];
  costBenefitAnalysis: {
    estimatedDevelopmentHours: number;
    developmentCostUSD: number;
    annualSubscriptionCostUSD: number;
    estimatedAnnualSavingsUSD: number;
    paybackPeriodMonths: number;
    roiPercent: number;
    manualHoursReducedPerMonth: number;
  };
  additionalSubscriptions: { toolName: string; monthlyCostUSD: number; linkedKeyActivity: string }[];
}

export interface GenerateVprsPdfPackInput {
  proc: VprsProcessInput;
  plan: VprsDeploymentPlanInput;
  profile?: 'full' | 'brief';
}

export interface GenerateVprsPdfPackResult {
  pdfBase64: string;
  html: string;
  markdown: string;
  manifest: unknown[];
  profile: string;
  specValidationWarnings?: string[];
}

/* ============================== The mapper ================================ */

const id3 = (n: number) => String(n).padStart(3, '0');

// Group boilerplate (security, documentation, support SLAs, vendor
// deliverables, exceptions/controls, AI guardrails) is only curated in
// Indonesian in vprs-pdf/src/defaults.js — an 'en' spec would render with
// none of it merged in. So this pack is always generated in Indonesian
// regardless of the app's own UI language toggle; an English Group-defaults
// bundle is future work (see vprs-pdf/src/defaults.js's DEFAULTS map).
const LANGUAGE = 'id' as const;

function mapSolutionType(rec: VprsDeploymentPlanInput['recommendedSolutionType']): string {
  switch (rec) {
    case 'RPA / Automation':
      return 'RPA Bot';
    case 'Agentic AI':
      return 'AI / Agentic AI';
    case 'Hybrid System':
      // No exact match in the VPRS enum; a hybrid still needs the AI
      // guardrails section (section 9), which only hydrates for 'AI /
      // Agentic AI' and 'RPA Bot', so this is the closer of the two.
      return 'AI / Agentic AI';
    default:
      return 'Application / Dashboard';
  }
}

function actorForStep(step: VprsProcessStepInput): string {
  switch (step.aiClassification) {
    case 'agentic-ai':
      return 'Agentic AI';
    case 'automation':
      return 'RPA / Automation';
    case 'human-in-the-loop':
      return 'Peninjau Manusia';
    default:
      return 'Pemilik Proses';
  }
}

/** A short flowchart, one node per step in order — see vprs-pdf/README.md's
 *  rendering notes on why a flowchart, not a sequence diagram, is the safer
 *  default (narrower boxes read fine at any step count; a sequence diagram's
 *  participant-width math gets touchy past a handful of actors). */
function buildMermaid(steps: VprsProcessStepInput[]): string {
  const esc = (s: string) => s.replace(/"/g, "'").replace(/\n/g, ' ');
  const nodes = steps.map((s, i) => `  S${i + 1}["${i + 1}. ${esc(s.name)}"]`);
  const edges = steps.slice(1).map((_, i) => `  S${i + 1} --> S${i + 2}`);
  return ['flowchart TD', ...nodes, ...edges].join('\n');
}

/** Splits a free-text opportunity statement into a handful of objective
 *  bullets. Falls back to the whole string as one bullet if it doesn't split
 *  cleanly — never fabricates objectives beyond what was actually written. */
function splitObjectives(text: string | undefined): string[] {
  if (!text || !text.trim()) return [];
  const parts = text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text.trim()];
}

/**
 * Builds a VPRS spec from a catalogue Process + its generated deployment
 * plan. Deliberately omits anything genuinely unknown at this stage (e.g.
 * integration protocol/frequency, out-of-scope boundaries) rather than
 * inventing plausible-sounding specifics — see the "To be confirmed with
 * vendor" notes below and vprs-pdf/README's own "nothing is emitted as a
 * placeholder" rule.
 */
export function buildVprsSpec(input: GenerateVprsPdfPackInput): Record<string, unknown> {
  const { proc, plan } = input;
  const steps = proc.steps || [];

  const systemNames = Array.from(new Set(steps.flatMap((s) => s.systems || []).filter(Boolean)));
  const gaps = proc.gaps || [];
  const decisionPoints = steps.flatMap((s) => (s.decisionPoints || []).map((d) => ({ step: s.name, d })));

  const functional = steps.map((s, i) => ({
    id: `FR-${id3(i + 1)}`,
    priority: 'Must' as const,
    requirement: `Sistem harus mendukung langkah "${s.name}": ${s.description}`,
  }));

  const spec: Record<string, unknown> = {
    meta: {
      projectId: proc.id,
      catalogRef: proc.category ? `${proc.category} — ${proc.title}` : proc.title,
      title: proc.title,
      solutionType: mapSolutionType(plan.recommendedSolutionType),
      version: '1.0 — Draf untuk Penawaran Vendor',
      status: proc.status,
      businessUnit: proc.subFunction,
      processOwner: proc.ownerName,
      preparedBy: 'Blueprint AI — Consolidated PRD & Engine Hub',
      issueDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      classification: 'Rahasia — Distribusi Vendor di Bawah NDA',
      ...(proc.completenessScore != null ? { readinessScore: `${Math.round(proc.completenessScore)}%` } : {}),
      language: LANGUAGE,
      organisation: 'Siloam Hospitals Group',
    },

    overview: {
      problem: proc.problemStatement || proc.description,
      ...(splitObjectives(proc.aiOpportunity).length ? { objectives: splitObjectives(proc.aiOpportunity) } : {}),
      currentState: systemNames.length
        ? `Saat ini terdiri dari ${steps.length} langkah manual yang melibatkan ${systemNames.length} sistem: ${systemNames.join(', ')}.`
        : `Saat ini terdiri dari ${steps.length} langkah manual.`,
      targetState: `${plan.recommendedSolutionType} dengan estimasi pengurangan ${Math.round(plan.costBenefitAnalysis.manualHoursReducedPerMonth)} jam kerja manual per bulan.`,
      volumetrics: [
        { metric: 'Estimasi jam kerja manual berkurang / bulan', value: `${Math.round(plan.costBenefitAnalysis.manualHoursReducedPerMonth)} jam` },
        { metric: 'Estimasi penghematan tahunan (USD)', value: `$${Math.round(plan.costBenefitAnalysis.estimatedAnnualSavingsUSD).toLocaleString('en-US')}` },
        { metric: 'Periode payback', value: `${plan.costBenefitAnalysis.paybackPeriodMonths} bulan` },
        { metric: 'ROI', value: `${plan.costBenefitAnalysis.roiPercent}%` },
      ],
    },

    solution: {
      summary: proc.description,
      autonomyLevel: 'Manusia-dalam-lingkar dengan gerbang persetujuan supervisor.',
      ...(plan.additionalSubscriptions.length
        ? { components: plan.additionalSubscriptions.map((s) => ({ component: s.toolName, responsibility: s.linkedKeyActivity })) }
        : {}),
    },

    ...(steps.length ? { scope: { inScope: steps.map((s) => s.name) } } : {}),

    process: {
      narrative: proc.description,
      mermaid: buildMermaid(steps),
      figureCaption: `Ringkasan alur proses: ${proc.title}`,
      steps: steps.map((s, i) => ({
        id: `P-${id3(i + 1)}`,
        actor: actorForStep(s),
        step: `${s.name}: ${s.description}`,
        ...(s.outputs && s.outputs.length ? { output: s.outputs.join('; ') } : {}),
      })),
    },

    ...(systemNames.length
      ? {
          systems: {
            integrations: systemNames.map((name, i) => ({
              id: `INT-${id3(i + 1)}`,
              system: name,
              role: 'Sistem sumber/tujuan untuk proses ini',
              // Protocol/direction/frequency aren't captured at catalogue
              // stage — flagged rather than guessed, so a vendor RFP doesn't
              // read as more technically specified than it actually is.
              protocol: 'Dikonfirmasi bersama vendor',
              direction: 'Dua arah (dikonfirmasi bersama vendor)',
              frequency: 'Dikonfirmasi bersama vendor',
            })),
          },
        }
      : {}),

    requirements: {
      functional,
      ...(gaps.length
        ? {
            business: gaps.map((g, i) => ({
              id: `BR-${id3(i + 1)}`,
              priority: 'Should' as const,
              rule: g,
              rationale: 'Teridentifikasi selama dokumentasi katalog proses (analisis gap).',
            })),
          }
        : {}),
    },

    ...(decisionPoints.length
      ? {
          exceptions: {
            matrix: decisionPoints.slice(0, 20).map((dp, i) => ({
              id: `EX-${id3(i + 1)}`,
              condition: `${dp.step}: ${dp.d}`,
              severity: 'Medium' as const,
              handling: 'Dieskalasikan ke pemilik proses untuk keputusan manual; tercatat dalam log audit.',
            })),
          },
        }
      : {}),

    testing: functional.map((fr, i) => ({
      id: `AC-${id3(i + 1)}`,
      requirementRef: fr.id,
      given: 'Data masukan tersedia dan valid untuk langkah terkait',
      when: 'Langkah tersebut dijalankan oleh solusi',
      then: 'Keluaran dihasilkan sesuai spesifikasi dan tercatat dalam log audit.',
    })),

    roadmap: plan.deploymentSteps.map((step, i) => ({
      id: `FASE-${i + 1}`,
      phase: step.phase,
      theme: step.title,
      description: step.description,
      systems: step.systemsInvolved,
      actions: step.actionItems,
    })),
  };

  return spec;
}

/* =========================== Serverless Chromium =========================== */

// Must match the @sparticuz/chromium-min version pinned in package.json —
// this is the release tag whose pack this downloads. See the file-level
// comment above for why 143.0.4 specifically (Node engine compatibility)
// and how to safely bump it.
const SPARTICUZ_CHROMIUM_VERSION = '143.0.4';
const SPARTICUZ_PACK_URL = `https://github.com/Sparticuz/chromium/releases/download/v${SPARTICUZ_CHROMIUM_VERSION}/chromium-v${SPARTICUZ_CHROMIUM_VERSION}-pack.x64.tar`;

let cachedSparticuz: { executablePath: string; args: string[] } | null = null;

/**
 * Resolves a Chromium executable for the PDF stage when running on Vercel
 * (no browser bundled in the function image). Returns null locally/on any
 * other host — vprs-pdf/src/pdf.js's own discoverChromium() already finds a
 * dev-machine Chromium (e.g. under PLAYWRIGHT_BROWSERS_PATH) when this
 * returns null, so this only needs to act on Vercel.
 *
 * Downloads and extracts the pack from GitHub Releases on the first call in
 * a given function instance (~2.5s, hand-verified) and caches the result
 * both here (module scope survives warm invocations) and on disk (@sparticuz/
 * chromium-min itself skips the download if /tmp/chromium already exists —
 * so a warm container pays this cost once, not per-request).
 */
async function resolveServerlessChromium(): Promise<{ executablePath: string; args: string[] } | null> {
  if (!process.env.VERCEL) return null;
  if (cachedSparticuz) return cachedSparticuz;
  const chromiumModule = (await import('@sparticuz/chromium-min')).default as {
    executablePath: (url: string) => Promise<string>;
    args: string[];
  };
  cachedSparticuz = {
    executablePath: await chromiumModule.executablePath(SPARTICUZ_PACK_URL),
    args: chromiumModule.args,
  };
  return cachedSparticuz;
}

/* ============================== Orchestration ============================== */

export async function generateVprsPdfPack(input: GenerateVprsPdfPackInput): Promise<GenerateVprsPdfPackResult> {
  const spec = buildVprsSpec(input);

  // Validate before handing to the renderer so a mapping bug surfaces as a
  // clear schema error instead of a confusing render failure deep in
  // Chromium — generate() validates too, but this lets us return the AJV
  // error list verbatim for debugging.
  const { valid, errors } = validateSpec(spec);
  if (!valid) {
    throw Object.assign(new Error(`Generated VPRS spec failed schema validation:\n- ${errors.join('\n- ')}`), {
      validationErrors: errors,
    });
  }

  const chromium = await resolveServerlessChromium();
  const outDir = path.join(os.tmpdir(), `vprs-${randomUUID()}`);
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const result = await generate({
      spec,
      outDir,
      profile: input.profile || 'full',
      executablePath: chromium?.executablePath,
      launchArgs: chromium?.args,
    });

    const pdfBuffer = fs.readFileSync(result.pdf as string);
    const html = fs.readFileSync(result.html as string, 'utf8');
    const markdown = fs.readFileSync(result.markdown as string, 'utf8');

    return {
      pdfBase64: pdfBuffer.toString('base64'),
      html,
      markdown,
      manifest: result.manifest,
      profile: input.profile || 'full',
    };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}
