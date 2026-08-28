/**
 * Local-only persistence for the PRD Engine Hub, used when
 * VITE_ENABLE_REMOTE_AUTH is unset and there is no Postgres backend to talk
 * to. Mirrors the read/seed-once/write-through shape of the remote path
 * (blueprintApi.ts + api/_lib/prdEngine.ts) so PRDHub.tsx can treat both the
 * same way, just swapping which one it calls.
 *
 * Pure functions over an injectable Storage so they're unit-testable without
 * jsdom/localStorage (see prdEngineLocal.test.ts).
 */
import { PrdEngineRecord, CatalogueProcessRef } from './blueprintApi';
import { SEED_PRD_ENGINES } from '../data/prdEngineSeed';

export const PRD_ENGINE_STORAGE_KEY = 'bp_prd_engines';

// Same IDR formatting as api/_lib/prdEngine.ts / the old PRDHub constants (1 USD = Rp 16.000).
function formatIDR(usd: number): string {
  const val = usd * 16000;
  if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(2)} Miliar`;
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} Juta`;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function readAll(storage: StorageLike): PrdEngineRecord[] {
  const raw = storage.getItem(PRD_ENGINE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(storage: StorageLike, engines: PrdEngineRecord[]): void {
  storage.setItem(PRD_ENGINE_STORAGE_KEY, JSON.stringify(engines));
}

/**
 * Reads the persisted list, seeding it once (and only once) if nothing has
 * been saved yet. Once a value exists — even an empty array left behind by
 * "delete everything" — it is never re-seeded, so user deletions stick.
 */
export function loadPrdEngines(storage: StorageLike): PrdEngineRecord[] {
  const raw = storage.getItem(PRD_ENGINE_STORAGE_KEY);
  if (raw === null) {
    writeAll(storage, SEED_PRD_ENGINES);
    return SEED_PRD_ENGINES;
  }
  return readAll(storage);
}

export function deletePrdEngineLocal(storage: StorageLike, id: string): PrdEngineRecord[] {
  const remaining = loadPrdEngines(storage).filter((e) => e.id !== id);
  writeAll(storage, remaining);
  return remaining;
}

/** Which catalogue processes aren't yet covered by any persisted engine. */
function computeUnmappedProcesses(
  existingEngines: Pick<PrdEngineRecord, 'overlappingProcesses'>[],
  catalogueProcesses: CatalogueProcessRef[]
): CatalogueProcessRef[] {
  const mapped = new Set(existingEngines.flatMap((e) => e.overlappingProcesses));
  return catalogueProcesses.filter((p) => p.title && p.title.trim() !== '' && !mapped.has(p.title));
}

export interface SyncPrdEnginesLocalResult {
  created: boolean;
  engine: PrdEngineRecord | null;
  engines: PrdEngineRecord[];
}

/**
 * Local-mode equivalent of the server's generatePrdEngine() + persist step:
 * same consolidation heuristic, but reading/writing localStorage instead of
 * Postgres. Kept in lock-step with api/_lib/prdEngine.ts's generatePrdEngine.
 */
export function syncPrdEnginesLocal(
  storage: StorageLike,
  catalogueProcesses: CatalogueProcessRef[],
  opts: { idFactory?: () => string; now?: () => Date } = {}
): SyncPrdEnginesLocalResult {
  const idFactory = opts.idFactory ?? (() => `engine-dynamic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const now = opts.now ?? (() => new Date());

  const existing = loadPrdEngines(storage);
  const unmapped = computeUnmappedProcesses(existing, catalogueProcesses);
  if (unmapped.length === 0) {
    return { created: false, engine: null, engines: existing };
  }

  const engine: PrdEngineRecord = {
    id: idFactory(),
    title: 'Custom AI Orchestration Engine',
    iconKey: 'Sparkles',
    description: 'Auto-compiled orchestration engine derived from recently added organizational processes.',
    targetAudience: 'Cross-functional Operations',
    masterUsers: 'Process Owners, Analysts',
    ecosystemApps: 'Internal API Gateway, Cloud Storage, ERP modules',
    overlappingProcesses: unmapped.map((p) => p.title),
    capexLogic: 'Integration hooks for new custom workflows and AI orchestration logic.',
    opexLogic: 'Token consumption for generative analysis and cloud automation execution.',
    metrics: {
      volume: 'Dynamically scaled based on process usage',
      effort: 'Est. 40% reduction in manual tracking',
      annualSavings: formatIDR(25000),
      payback: '6 Bulan',
    },
    specifications: [
      'Dynamic data ingestion from user-defined inputs.',
      'LLM-based categorization and decision routing.',
      'Automated alerting and report generation.',
    ],
    isSeed: false,
    createdAt: now().toISOString(),
  };

  const engines = [...existing, engine];
  writeAll(storage, engines);
  return { created: true, engine, engines };
}
