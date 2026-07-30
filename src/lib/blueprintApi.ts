/**
 * Client for the Apps Script JSON API (apps-script/Code.gs doPost).
 *
 * When VITE_APPS_SCRIPT_URL is unset, the app falls back to its original
 * local-only mode (localStorage profile + Onboarding/LockScreen) — nothing
 * here is required for the app to run.
 *
 * Content-Type is deliberately text/plain, not application/json: a JSON
 * content-type triggers a CORS preflight (OPTIONS) request, which Apps
 * Script web apps cannot answer, so the request would be blocked entirely.
 */

import { Process } from '../types';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;

export function isRemoteEnabled(): boolean {
  return !!APPS_SCRIPT_URL;
}

export interface RemoteUser {
  username: string;
  name: string;
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'Admin';
  subFunction: string;
}

async function callApi<T>(action: string, token?: string, payload?: unknown): Promise<T> {
  if (!APPS_SCRIPT_URL) throw new Error('Apps Script backend is not configured (VITE_APPS_SCRIPT_URL is unset).');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload }),
  });
  if (!res.ok) throw new Error(`Backend request failed (HTTP ${res.status}).`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Backend request failed.');
  return json.data as T;
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
 * apps-script/Code.gs only exposes create (no upsert-by-id), so this is a
 * one-time snapshot taken when a process is first saved locally — later
 * local edits are not re-synced to the Sheet. Good enough for directorate
 * roll-up visibility; not a live mirror of the local copy.
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
