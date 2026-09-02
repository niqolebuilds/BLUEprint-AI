import { NeonQueryFunction } from '@neondatabase/serverless';
import { getSql } from './db.js';
import {
  generateSalt,
  generateTempPassword,
  hashPassword,
  issueToken,
  randomUUID,
  requireAdmin,
  requireAuth,
  verifyPassword,
  TokenPayload,
} from './auth.js';

type Sql = NeonQueryFunction<false, false>;

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'Admin'];

/* ============================ Schema bootstrap =========================== */
/* CREATE TABLE IF NOT EXISTS is idempotent — safe to run on every cold start
   instead of requiring a separate manual migration step. */

let schemaReady = false;

async function ensureSchema(sql: Sql): Promise<void> {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      username      text PRIMARY KEY,
      name          text NOT NULL,
      email         text NOT NULL,
      level         text NOT NULL CHECK (level IN ('L1', 'L2', 'L3', 'L4', 'Admin')),
      sub_function  text NOT NULL DEFAULT 'All',
      password_hash text NOT NULL,
      salt          text NOT NULL,
      active        boolean NOT NULL DEFAULT true,
      created_at    timestamptz NOT NULL DEFAULT now(),
      last_login    timestamptz
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS processes (
      id                        uuid PRIMARY KEY,
      title                     text NOT NULL,
      description               text NOT NULL DEFAULT '',
      sub_function              text NOT NULL,
      owner_username            text NOT NULL REFERENCES users(username),
      owner_name                text NOT NULL,
      owner_email               text NOT NULL DEFAULT '',
      owner_level               text NOT NULL,
      status                    text NOT NULL DEFAULT 'Draft',
      last_updated              timestamptz NOT NULL DEFAULT now(),
      completeness_score        int NOT NULL DEFAULT 0,
      effort_rating             int NOT NULL DEFAULT 1,
      repetitiveness_rating     int NOT NULL DEFAULT 1,
      volume_rating             int NOT NULL DEFAULT 1,
      error_sensitivity_rating  int NOT NULL DEFAULT 1,
      automation_suitability    int NOT NULL DEFAULT 0,
      category                  text NOT NULL DEFAULT '',
      is_candidate_for_ai       boolean NOT NULL DEFAULT false,
      problem_statement         text NOT NULL DEFAULT '',
      ai_opportunity            text NOT NULL DEFAULT '',
      steps_agentic_count       int NOT NULL DEFAULT 0,
      steps_automation_count    int NOT NULL DEFAULT 0,
      steps_human_count         int NOT NULL DEFAULT 0,
      gaps                      text NOT NULL DEFAULT '',
      is_shared                 boolean NOT NULL DEFAULT false,
      created_at                timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS processes_owner_idx ON processes(owner_username)`;
  await sql`CREATE INDEX IF NOT EXISTS processes_sub_function_idx ON processes(sub_function)`;
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         bigserial PRIMARY KEY,
      username   text NOT NULL,
      action     text NOT NULL,
      detail     text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  schemaReady = true;
}

async function logAudit(sql: Sql, username: string, action: string, detail: string): Promise<void> {
  await sql`INSERT INTO audit_log (username, action, detail) VALUES (${username}, ${action}, ${detail || ''})`;
}

/* ============================== User admin ================================ */

async function generateUsername(sql: Sql, email: string): Promise<string> {
  const base = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '');
  const rows = await sql`SELECT username FROM users`;
  const existing = new Set(rows.map((r) => String(r.username).toLowerCase()));
  let candidate = base;
  let n = 1;
  while (existing.has(candidate)) candidate = base + ++n;
  return candidate;
}

async function createUser(
  sql: Sql,
  name: string,
  email: string,
  level: string,
  subFunction: string
): Promise<{ username: string; tempPassword: string }> {
  if (!LEVELS.includes(level)) throw new Error('Level must be one of: ' + LEVELS.join(', '));
  const username = await generateUsername(sql, email);
  const tempPassword = generateTempPassword();
  const salt = generateSalt();
  const passwordHash = hashPassword(tempPassword, salt);
  await sql`
    INSERT INTO users (username, name, email, level, sub_function, password_hash, salt, active)
    VALUES (${username}, ${name}, ${email}, ${level}, ${subFunction || 'All'}, ${passwordHash}, ${salt}, true)`;
  await logAudit(sql, 'SYSTEM', 'CREATE_USER', `${username} (${level})`);
  return { username, tempPassword };
}

async function resetPassword(sql: Sql, username: string): Promise<string> {
  const rows = await sql`SELECT username FROM users WHERE username = ${username}`;
  if (rows.length === 0) throw new Error('No user with that username.');
  const tempPassword = generateTempPassword();
  const salt = generateSalt();
  const passwordHash = hashPassword(tempPassword, salt);
  await sql`UPDATE users SET salt = ${salt}, password_hash = ${passwordHash} WHERE username = ${username}`;
  await logAudit(sql, 'SYSTEM', 'RESET_PASSWORD', username);
  return tempPassword;
}

/* ================================ Auth API ================================= */

async function apiBootstrapAdmin(sql: Sql, name: string, email: string): Promise<{ username: string; tempPassword: string }> {
  if (!name || !email) throw new Error('Name and email are required.');
  const rows = await sql`SELECT username, last_login FROM users`;
  if (rows.length === 0) {
    return createUser(sql, name, email, 'Admin', 'All');
  }
  if (rows.length === 1 && rows[0].last_login === null) {
    // Nobody has signed in yet — safe to reissue a fresh temp password for the
    // same bootstrap account rather than permanently locking this out if the
    // one-time password is lost before it's ever used.
    const tempPassword = await resetPassword(sql, rows[0].username);
    return { username: rows[0].username, tempPassword };
  }
  throw new Error('An Admin account already exists — ask them to create your account instead.');
}

async function apiLogin(sql: Sql, username: string, password: string) {
  username = String(username || '').trim();
  const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
  const genericError = 'Incorrect username or password.';
  const user = rows[0];
  if (!user || !user.active) throw new Error(genericError);
  if (!verifyPassword(password, user.salt, user.password_hash)) throw new Error(genericError);
  await sql`UPDATE users SET last_login = now() WHERE username = ${username}`;
  await logAudit(sql, username, 'LOGIN', '');
  const identity = { username: user.username, name: user.name, level: user.level, subFunction: user.sub_function };
  return { token: issueToken(identity), user: identity };
}

async function apiChangePassword(sql: Sql, token: string | undefined, oldPassword: string, newPassword: string) {
  const payload = requireAuth(token);
  const rows = await sql`SELECT * FROM users WHERE username = ${payload.u}`;
  const user = rows[0];
  if (!user) throw new Error('User not found.');
  if (!verifyPassword(oldPassword, user.salt, user.password_hash)) throw new Error('Current password is incorrect.');
  if (!newPassword || String(newPassword).length < 8) throw new Error('New password must be at least 8 characters.');
  const salt = generateSalt();
  const passwordHash = hashPassword(newPassword, salt);
  await sql`UPDATE users SET salt = ${salt}, password_hash = ${passwordHash} WHERE username = ${payload.u}`;
  await logAudit(sql, payload.u, 'CHANGE_PASSWORD', '');
  return { ok: true };
}

/* ============================= Dashboard API ============================= */

async function buildDirectorateDashboard(sql: Sql) {
  const processes = await sql`SELECT * FROM processes`;
  const users = await sql`SELECT * FROM users WHERE active = true`;

  const byStatus: Record<string, number> = {};
  const classificationMix = { agentic: 0, automation: 0, human: 0 };
  const bySubFunction: Record<string, { count: number; completenessSum: number }> = {};
  const ownerCounts: Record<string, number> = {};
  const contributors = new Set<string>();

  for (const p of processes) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    classificationMix.agentic += Number(p.steps_agentic_count) || 0;
    classificationMix.automation += Number(p.steps_automation_count) || 0;
    classificationMix.human += Number(p.steps_human_count) || 0;

    const sf = p.sub_function || 'Unspecified';
    if (!bySubFunction[sf]) bySubFunction[sf] = { count: 0, completenessSum: 0 };
    bySubFunction[sf].count++;
    bySubFunction[sf].completenessSum += Number(p.completeness_score) || 0;

    const owner = p.owner_name || p.owner_username;
    ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
    contributors.add(p.owner_username);
  }

  const subFunctionSummary = Object.entries(bySubFunction)
    .map(([subFunction, d]) => ({ subFunction, count: d.count, avgCompleteness: Math.round(d.completenessSum / d.count) }))
    .sort((a, b) => b.count - a.count);

  const champions = Object.entries(ownerCounts)
    .map(([name, processCount]) => ({ name, processCount }))
    .sort((a, b) => b.processCount - a.processCount)
    .slice(0, 5);

  const topCandidates = processes
    .filter((p) => p.automation_suitability !== null && p.automation_suitability !== undefined)
    .sort((a, b) => (Number(b.automation_suitability) || 0) - (Number(a.automation_suitability) || 0))
    .slice(0, 10)
    .map((p) => ({
      title: p.title,
      owner: p.owner_name,
      subFunction: p.sub_function,
      suitability: Number(p.automation_suitability) || 0,
      status: p.status,
    }));

  return {
    totalProcesses: processes.length,
    totalActiveUsers: users.length,
    submissionRatePercent: users.length ? Math.round((contributors.size / users.length) * 100) : 0,
    byStatus,
    classificationMix,
    subFunctionSummary,
    champions,
    topCandidates,
  };
}

async function buildTeamDashboard(sql: Sql, payload: TokenPayload) {
  const sub = payload.sub;
  const processes = await sql`SELECT * FROM processes WHERE sub_function = ${sub}`;
  const teamUsers = await sql`SELECT * FROM users WHERE sub_function = ${sub} AND active = true`;

  const countByOwner: Record<string, number> = {};
  const scoresByOwner: Record<string, number[]> = {};
  for (const p of processes) {
    countByOwner[p.owner_username] = (countByOwner[p.owner_username] || 0) + 1;
    (scoresByOwner[p.owner_username] ||= []).push(Number(p.completeness_score) || 0);
  }

  const completionTracker = teamUsers.map((u) => {
    const count = countByOwner[u.username] || 0;
    const scores = scoresByOwner[u.username] || [];
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { name: u.name, username: u.username, level: u.level, processCount: count, avgCompleteness: avg, hasSubmitted: count > 0 };
  });

  const highEffortFlags = processes
    .filter((p) => (Number(p.effort_rating) || 0) >= 4 || (Number(p.volume_rating) || 0) >= 4)
    .sort((a, b) => (Number(b.effort_rating) || 0) - (Number(a.effort_rating) || 0))
    .map((p) => ({ title: p.title, owner: p.owner_name, effort: Number(p.effort_rating) || 0, volume: Number(p.volume_rating) || 0, status: p.status }));

  const guidanceTracker = processes
    .filter((p) => (Number(p.completeness_score) || 0) < 50)
    .sort((a, b) => (Number(a.completeness_score) || 0) - (Number(b.completeness_score) || 0))
    .map((p) => ({ title: p.title, owner: p.owner_name, completeness: Number(p.completeness_score) || 0, status: p.status }));

  return { subFunction: sub, completionTracker, highEffortFlags, guidanceTracker };
}

async function buildPersonalDashboard(sql: Sql, payload: TokenPayload) {
  const processes = await sql`SELECT * FROM processes WHERE owner_username = ${payload.u}`;
  const mix = { agentic: 0, automation: 0, human: 0 };
  for (const p of processes) {
    mix.agentic += Number(p.steps_agentic_count) || 0;
    mix.automation += Number(p.steps_automation_count) || 0;
    mix.human += Number(p.steps_human_count) || 0;
  }
  const avgCompleteness = processes.length
    ? Math.round(processes.reduce((s, p) => s + (Number(p.completeness_score) || 0), 0) / processes.length)
    : 0;
  return {
    processes: processes.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      completeness: Number(p.completeness_score) || 0,
      suitability: Number(p.automation_suitability) || 0,
      lastUpdated: new Date(p.last_updated).toISOString(),
      subFunction: p.sub_function,
    })),
    summary: { count: processes.length, avgCompleteness, classificationMix: mix },
  };
}

async function buildAdminDashboard(sql: Sql) {
  const userRows = await sql`SELECT * FROM users`;
  const users = userRows.map((u) => ({
    username: u.username,
    name: u.name,
    email: u.email,
    level: u.level,
    subFunction: u.sub_function,
    active: u.active,
    lastLogin: u.last_login ? new Date(u.last_login).toISOString() : '',
  }));
  const processes = await sql`SELECT * FROM processes`;

  const byLevel: Record<string, number> = {};
  for (const u of users) byLevel[u.level] = (byLevel[u.level] || 0) + 1;

  const dataQuality = processes
    .map((p) => {
      const missing: string[] = [];
      if (!p.description) missing.push('Description');
      if (!p.problem_statement) missing.push('ProblemStatement');
      if (!Number(p.completeness_score)) missing.push('CompletenessScore');
      return { id: p.id, title: p.title, owner: p.owner_name, missing };
    })
    .filter((p) => p.missing.length > 0);

  const bySF: Record<string, { total: number; approved: number }> = {};
  for (const p of processes) {
    const sf = p.sub_function || 'Unspecified';
    if (!bySF[sf]) bySF[sf] = { total: 0, approved: 0 };
    bySF[sf].total++;
    if (p.status === 'Approved') bySF[sf].approved++;
  }
  const readiness = Object.entries(bySF).map(([subFunction, d]) => ({
    subFunction,
    total: d.total,
    approved: d.approved,
    readinessPercent: Math.round((d.approved / d.total) * 100),
  }));

  return { userCounts: byLevel, totalUsers: users.length, users, totalProcesses: processes.length, dataQuality, readiness };
}

async function apiGetDashboard(sql: Sql, token: string | undefined) {
  const payload = requireAuth(token);
  const me = { username: payload.u, name: payload.n, level: payload.lvl, subFunction: payload.sub };
  switch (payload.lvl) {
    case 'Admin':
      return { me, view: 'admin', data: await buildAdminDashboard(sql) };
    case 'L1':
    case 'L2':
      return { me, view: 'directorate', data: await buildDirectorateDashboard(sql) };
    case 'L3':
      return { me, view: 'team', data: await buildTeamDashboard(sql, payload) };
    case 'L4':
      return { me, view: 'personal', data: await buildPersonalDashboard(sql, payload) };
    default:
      throw new Error('Unknown role: ' + payload.lvl);
  }
}

/* ============================== Process API =============================== */

function clamp1to5(v: unknown): number {
  const n = Number(v) || 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Same triage heuristic as apps-script/Code.gs's computeSuitability_. */
function computeSuitability(effort: number, repetitiveness: number, volume: number, errorSensitivity: number): number {
  const raw = ((repetitiveness + volume + errorSensitivity) / 15) * 100 - effort * 3;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

interface ProcessForm {
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

async function apiSubmitProcess(sql: Sql, token: string | undefined, form: ProcessForm) {
  const payload = requireAuth(token);
  if (!form || !form.title || !form.subFunction) throw new Error('Title and sub-function are required.');
  const effort = clamp1to5(form.effortRating);
  const repetitiveness = clamp1to5(form.repetitivenessRating);
  const volume = clamp1to5(form.volumeRating);
  const errorSensitivity = clamp1to5(form.errorSensitivityRating);
  const suitability = computeSuitability(effort, repetitiveness, volume, errorSensitivity);
  const userRows = await sql`SELECT email FROM users WHERE username = ${payload.u}`;
  const ownerEmail = userRows[0]?.email || '';
  const id = randomUUID();

  await sql`
    INSERT INTO processes (
      id, title, description, sub_function, owner_username, owner_name, owner_email, owner_level,
      status, completeness_score, effort_rating, repetitiveness_rating, volume_rating, error_sensitivity_rating,
      automation_suitability, category, is_candidate_for_ai, problem_statement, ai_opportunity,
      steps_agentic_count, steps_automation_count, steps_human_count, gaps, is_shared
    ) VALUES (
      ${id}, ${form.title}, ${form.description || ''}, ${form.subFunction}, ${payload.u}, ${payload.n}, ${ownerEmail}, ${payload.lvl},
      ${form.status || 'Draft'}, ${Number(form.completenessScore) || 0}, ${effort}, ${repetitiveness}, ${volume}, ${errorSensitivity},
      ${suitability}, ${form.category || ''}, ${suitability >= 60}, ${form.problemStatement || ''}, ${form.aiOpportunity || ''},
      ${Number(form.stepsAgenticCount) || 0}, ${Number(form.stepsAutomationCount) || 0}, ${Number(form.stepsHumanCount) || 0},
      ${form.gaps || ''}, ${!!form.isShared}
    )`;
  await logAudit(sql, payload.u, 'SUBMIT_PROCESS', `${id} - ${form.title}`);
  return { ok: true, id, automationSuitability: suitability };
}

interface ProcessPatch {
  title?: string;
  description?: string;
  status?: string;
  category?: string;
  problemStatement?: string;
  aiOpportunity?: string;
  gaps?: string;
}

async function apiUpdateProcess(sql: Sql, token: string | undefined, id: string, patch: ProcessPatch) {
  const payload = requireAuth(token);
  const rows = await sql`SELECT owner_username FROM processes WHERE id = ${id}`;
  const record = rows[0];
  if (!record) throw new Error('Process not found.');
  if (record.owner_username !== payload.u && payload.lvl !== 'Admin') throw new Error('You can only edit your own processes.');

  if (patch.title !== undefined) await sql`UPDATE processes SET title = ${patch.title}, last_updated = now() WHERE id = ${id}`;
  if (patch.description !== undefined) await sql`UPDATE processes SET description = ${patch.description}, last_updated = now() WHERE id = ${id}`;
  if (patch.status !== undefined) await sql`UPDATE processes SET status = ${patch.status}, last_updated = now() WHERE id = ${id}`;
  if (patch.category !== undefined) await sql`UPDATE processes SET category = ${patch.category}, last_updated = now() WHERE id = ${id}`;
  if (patch.problemStatement !== undefined)
    await sql`UPDATE processes SET problem_statement = ${patch.problemStatement}, last_updated = now() WHERE id = ${id}`;
  if (patch.aiOpportunity !== undefined)
    await sql`UPDATE processes SET ai_opportunity = ${patch.aiOpportunity}, last_updated = now() WHERE id = ${id}`;
  if (patch.gaps !== undefined) await sql`UPDATE processes SET gaps = ${patch.gaps}, last_updated = now() WHERE id = ${id}`;

  await logAudit(sql, payload.u, 'UPDATE_PROCESS', id);
  return { ok: true };
}

async function apiDeleteProcess(sql: Sql, token: string | undefined, id: string) {
  const payload = requireAuth(token);
  const rows = await sql`SELECT owner_username FROM processes WHERE id = ${id}`;
  const record = rows[0];
  if (!record) throw new Error('Process not found.');
  if (record.owner_username !== payload.u && payload.lvl !== 'Admin') throw new Error('You can only delete your own processes.');
  await sql`DELETE FROM processes WHERE id = ${id}`;
  await logAudit(sql, payload.u, 'DELETE_PROCESS', id);
  return { ok: true };
}

/* =============================== Admin API ================================ */

interface AdminCreateUserForm {
  name: string;
  email: string;
  level: string;
  subFunction?: string;
}

async function apiAdminCreateUser(sql: Sql, token: string | undefined, form: AdminCreateUserForm) {
  requireAdmin(token);
  if (!form || !form.name || !form.email || !form.level) throw new Error('Name, email and level are required.');
  const level = String(form.level).toLowerCase() === 'admin' ? 'Admin' : String(form.level).toUpperCase();
  return createUser(sql, form.name, form.email, level, form.subFunction || 'All');
}

async function apiAdminResetPassword(sql: Sql, token: string | undefined, username: string) {
  requireAdmin(token);
  return { tempPassword: await resetPassword(sql, username) };
}

async function apiAdminSetActive(sql: Sql, token: string | undefined, username: string, active: boolean) {
  const payload = requireAdmin(token);
  const rows = await sql`SELECT username FROM users WHERE username = ${username}`;
  if (rows.length === 0) throw new Error('No user with that username.');
  await sql`UPDATE users SET active = ${!!active} WHERE username = ${username}`;
  await logAudit(sql, payload.u, active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', username);
  return { ok: true };
}

function csvEscape(value: unknown): string {
  const s = value instanceof Date ? value.toISOString() : String(value ?? '');
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function apiAdminExportCsv(sql: Sql, token: string | undefined) {
  const payload = requireAdmin(token);
  const rows = await sql`SELECT * FROM processes ORDER BY created_at`;
  await logAudit(sql, payload.u, 'EXPORT_CSV', '');
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))];
  return lines.join('\n');
}

/* ================================== Router ================================= */

export async function routeAction(action: string, token: string | undefined, payload: any = {}): Promise<unknown> {
  const sql = getSql();
  await ensureSchema(sql);
  switch (action) {
    case 'bootstrapAdmin':
      return apiBootstrapAdmin(sql, payload.name, payload.email);
    case 'login':
      return apiLogin(sql, payload.username, payload.password);
    case 'changePassword':
      return apiChangePassword(sql, token, payload.oldPassword, payload.newPassword);
    case 'getDashboard':
      return apiGetDashboard(sql, token);
    case 'submitProcess':
      return apiSubmitProcess(sql, token, payload);
    case 'updateProcess':
      return apiUpdateProcess(sql, token, payload.id, payload.patch || {});
    case 'deleteProcess':
      return apiDeleteProcess(sql, token, payload.id);
    case 'adminCreateUser':
      return apiAdminCreateUser(sql, token, payload);
    case 'adminResetPassword':
      return apiAdminResetPassword(sql, token, payload.username);
    case 'adminSetActive':
      return apiAdminSetActive(sql, token, payload.username, payload.active);
    case 'adminExportCsv':
      return apiAdminExportCsv(sql, token);
    default:
      throw new Error('Unknown action: ' + action);
  }
}
