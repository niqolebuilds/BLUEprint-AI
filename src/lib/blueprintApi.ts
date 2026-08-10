/**
 * Client for the Postgres-backed API (api/blueprint.ts, same-origin on Vercel;
 * proxied through /api/blueprint locally by server.ts for `npm run dev`).
 *
 * When VITE_ENABLE_REMOTE_AUTH is unset, the app falls back to its original
 * local-only mode (localStorage profile + Onboarding/LockScreen) — nothing
 * here is required for the app to run.
 */

import { Process } from '../types';

const REMOTE_AUTH_ENABLED = import.meta.env.VITE_ENABLE_REMOTE_AUTH === 'true';

export function isRemoteEnabled(): boolean {
  return REMOTE_AUTH_ENABLED;
}

export interface RemoteUser {
  username: string;
  name: string;
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'Admin';
  subFunction: string;
}

async function callApi<T>(action: string, token?: string, payload?: unknown): Promise<T> {
  const res = await fetch('/api/blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, token, payload }),
  });
  if (!res.ok) throw new Error(`Backend request failed (HTTP ${res.status}).`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Backend request failed.');
  return json.data as T;
}

/** Only succeeds once — the first call with zero users in the database creates the Admin. */
export function bootstrapAdmin(name: string, email: string) {
  return callApi<{ username: string; tempPassword: string }>('bootstrapAdmin', undefined, { name, email });
}

export function remoteLogin(username: string, password: string) {
  return callApi<{ token: string; user: RemoteUser }>('login', undefined, { username, password });
}

export function remoteChangePassword(token: string, oldPassword: string, newPassword: string) {
  return callApi<{ ok: true }>('changePassword', token, { oldPassword, newPassword });
}

export function getRemoteDashboard(token: string) {
  return callApi<{ me: RemoteUser; view: string; data: unknown }>('getDashboard', token);
}

export interface RemoteProcessInput {
  title: string;
  description?: string;
  subFunction: string;
  status?: string;
  completenessScore?: number;
  effortRating?: number;
  repetitivenessRating?: number;
  volumeRating?: number;
  errorSensitivityRating?: number;
  category?: string;
  problemStatement?: string;
  aiOpportunity?: string;
  stepsAgenticCount?: number;
  stepsAutomationCount?: number;
  stepsHumanCount?: number;
  gaps?: string;
  isShared?: boolean;
}

export function submitRemoteProcess(token: string, input: RemoteProcessInput) {
  return callApi<{ ok: true; id: string; automationSuitability: number }>('submitProcess', token, input);
}

/**
 * The API only supports create (no upsert-by-id), so this is a one-time
 * snapshot taken when a process is first saved locally — later local edits
 * are not re-synced to Postgres. Good enough for directorate roll-up
 * visibility; not a live mirror of the local copy.
 */
export function mapProcessToRemoteInput(p: Process): RemoteProcessInput {
  const counts = { agentic: 0, automation: 0, human: 0 };
  for (const s of p.steps) {
    const cls = p.userOverrides?.[s.id] ?? s.aiClassification;
    if (cls === 'agentic-ai') counts.agentic++;
    else if (cls === 'automation') counts.automation++;
    else if (cls === 'human-in-the-loop') counts.human++;
  }
  return {
    title: p.title,
    description: p.description,
    subFunction: p.subFunction,
    status: p.status,
    completenessScore: p.completenessScore,
    effortRating: p.effortRating,
    repetitivenessRating: p.repetitivenessRating,
    volumeRating: p.volumeRating,
    errorSensitivityRating: p.errorSensitivityRating,
    category: p.category,
    problemStatement: p.problemStatement,
    aiOpportunity: p.aiOpportunity,
    stepsAgenticCount: counts.agentic,
    stepsAutomationCount: counts.automation,
    stepsHumanCount: counts.human,
    gaps: p.gaps?.join(', '),
    isShared: p.isShared,
  };
}

export function deleteRemoteProcess(token: string, id: string) {
  return callApi<{ ok: true }>('deleteProcess', token, { id });
}

export function adminCreateRemoteUser(token: string, form: { name: string; email: string; level: string; subFunction?: string }) {
  return callApi<{ username: string; tempPassword: string }>('adminCreateUser', token, form);
}

export function adminResetRemotePassword(token: string, username: string) {
  return callApi<{ tempPassword: string }>('adminResetPassword', token, { username });
}

export function adminSetRemoteActive(token: string, username: string, active: boolean) {
  return callApi<{ ok: true }>('adminSetActive', token, { username, active });
}

export function adminExportRemoteCsv(token: string) {
  return callApi<string>('adminExportCsv', token);
}

/* ============================== PRD Engine Hub ============================= */

export interface PrdEngineMetrics {
  volume: string;
  effort: string;
  annualSavings: string;
  payback: string;
}

export interface PrdEngineRecord {
  id: string;
  title: string;
  iconKey: string;
  description: string;
  targetAudience: string;
  masterUsers: string;
  ecosystemApps: string;
  overlappingProcesses: string[];
  capexLogic: string;
  opexLogic: string;
  metrics: PrdEngineMetrics;
  specifications: string[];
  isSeed: boolean;
  createdAt: string;
}

export interface CatalogueProcessRef {
  id?: string;
  title: string;
}

/** Reads the persisted, org-wide engine list from Postgres — the source of truth. */
export function listRemotePrdEngines(token: string) {
  return callApi<PrdEngineRecord[]>('listPrdEngines', token);
}

/** Soft-deletes server-side; the row is gone on every subsequent list call, including after logout/login. */
export function deleteRemotePrdEngine(token: string, id: string) {
  return callApi<{ ok: true }>('deletePrdEngine', token, { id });
}

/** Runs the consolidation/generation step server-side and persists the result if one was produced. */
export function syncRemotePrdEngines(token: string, processes: CatalogueProcessRef[]) {
  return callApi<{ created: boolean; engine: PrdEngineRecord | null }>('syncPrdEngines', token, { processes });
}
