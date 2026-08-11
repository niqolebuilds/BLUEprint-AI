/**
 * Integration-style tests for the PRD Engine actions, proving the actual bug
 * fix: deletes and syncs are written through `routeAction` (the same entry
 * point api/blueprint.ts and server.ts's /api/blueprint use) to a store that
 * outlives any single request — standing in for Postgres via an in-memory
 * fake `sql` tagged-template (see createFakeSql below). Each `routeAction`
 * call here is a fresh, independent call, exactly like a fresh request after
 * a reload or a new login session — nothing is carried over via component
 * state or closures, only via the fake "database".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ fake: null as any }));

vi.mock('./db.js', () => ({
  getSql: () => state.fake.sql,
}));

import { routeAction } from './actions';
import { issueToken } from './auth';
import { SEED_PRD_ENGINES } from './prdEngine';

/** Minimal in-memory stand-in for the Neon tagged-template `sql` function. */
function createFakeSql() {
  const engines: any[] = [];
  const auditLog: any[] = [];

  const sql = (async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join(' ');

    if (/CREATE TABLE|CREATE INDEX/i.test(text)) return [];

    if (/INSERT INTO audit_log/i.test(text)) {
      auditLog.push({ username: values[0], action: values[1], detail: values[2] });
      return [];
    }

    if (/SELECT count\(\*\)::int AS n FROM prd_engines/i.test(text)) {
      return [{ n: engines.length }];
    }

    if (/INSERT INTO prd_engines/i.test(text)) {
      const [
        id, title, icon_key, description, target_audience, master_users, ecosystem_apps,
        overlapping_processes, capex_logic, opex_logic, metrics, specifications, is_seed, created_by,
      ] = values;
      engines.push({
        id, title, icon_key, description, target_audience, master_users, ecosystem_apps,
        overlapping_processes, capex_logic, opex_logic, metrics, specifications,
        is_seed, created_by, deleted_at: null, created_at: new Date().toISOString(),
      });
      return [];
    }

    if (/UPDATE prd_engines SET deleted_at = now\(\)/i.test(text)) {
      const [id] = values;
      const row = engines.find((e) => e.id === id && e.deleted_at === null);
      if (!row) return [];
      row.deleted_at = new Date().toISOString();
      return [{ id: row.id }];
    }

    if (/SELECT \* FROM prd_engines WHERE deleted_at IS NULL ORDER BY created_at/i.test(text)) {
      return engines
        .filter((e) => e.deleted_at === null)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    if (/SELECT overlapping_processes FROM prd_engines WHERE deleted_at IS NULL/i.test(text)) {
      return engines.filter((e) => e.deleted_at === null).map((e) => ({ overlapping_processes: e.overlapping_processes }));
    }

    throw new Error('Unhandled fake SQL in test: ' + text);
  }) as any;

  return { sql, engines, auditLog };
}

function adminToken() {
  return issueToken({ username: 'admin1', name: 'Admin One', level: 'Admin', subFunction: 'All' });
}
function nonAdminToken() {
  return issueToken({ username: 'l4user', name: 'Regular User', level: 'L4', subFunction: 'Finance' });
}

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'test-secret-for-prd-engine-tests';
  state.fake = createFakeSql();
});

describe('listPrdEngines', () => {
  it('seeds an empty table exactly once, not on every call', async () => {
    const first = (await routeAction('listPrdEngines', adminToken())) as any[];
    expect(first).toHaveLength(SEED_PRD_ENGINES.length);

    const second = (await routeAction('listPrdEngines', adminToken())) as any[];
    expect(second).toHaveLength(SEED_PRD_ENGINES.length); // not doubled
  });

  it('rejects requests with no token', async () => {
    await expect(routeAction('listPrdEngines', undefined)).rejects.toThrow();
  });
});

describe('deletePrdEngine — Symptom 1 (deletes must persist)', () => {
  it('removes the row from every subsequent list call, simulating logout/login', async () => {
    const before = (await routeAction('listPrdEngines', adminToken())) as any[];
    const target = before[0];

    await routeAction('deletePrdEngine', adminToken(), { id: target.id });

    // A brand-new routeAction call with a brand-new token — nothing but the
    // backing store carries state across this boundary, exactly like a
    // fresh request after the user logs back in.
    const afterFirstReload = (await routeAction('listPrdEngines', adminToken())) as any[];
    expect(afterFirstReload.find((e) => e.id === target.id)).toBeUndefined();
    expect(afterFirstReload).toHaveLength(before.length - 1);

    // And it stays gone — re-listing must not re-seed over the deletion.
    const afterSecondReload = (await routeAction('listPrdEngines', adminToken())) as any[];
    expect(afterSecondReload.find((e) => e.id === target.id)).toBeUndefined();
    expect(afterSecondReload).toHaveLength(before.length - 1);
  });

  it('only an Admin can delete', async () => {
    const list = (await routeAction('listPrdEngines', adminToken())) as any[];
    await expect(routeAction('deletePrdEngine', nonAdminToken(), { id: list[0].id })).rejects.toThrow(/admin/i);
  });

  it('rejects deleting an id that does not exist (or was already deleted)', async () => {
    await routeAction('listPrdEngines', adminToken()); // trigger seed
    await expect(routeAction('deletePrdEngine', adminToken(), { id: 'not-a-real-id' })).rejects.toThrow();
  });
});

describe('syncPrdEngines — Symptom 2 (sync must generate + persist a new PRD)', () => {
  it('does nothing when every catalogue process is already mapped', async () => {
    const seeded = (await routeAction('listPrdEngines', adminToken())) as any[];
    const alreadyMapped = seeded.flatMap((e) => e.overlappingProcesses).map((title: string) => ({ title }));

    const result = (await routeAction('syncPrdEngines', nonAdminToken(), { processes: alreadyMapped })) as {
      created: boolean;
      engine: any;
    };

    expect(result.created).toBe(false);
    expect(result.engine).toBeNull();
  });

  it('generates a new engine from unmapped processes and persists it across a fresh list call', async () => {
    await routeAction('listPrdEngines', adminToken()); // ensure seeded

    const catalogue = [
      { id: 'p1', title: 'Monthly VAT & PPN Taxation Filing' }, // already mapped by the tax seed engine
      { id: 'p2', title: 'Payroll Reconciliation for Contract Nurses' }, // new
      { id: 'p3', title: 'Medical Equipment Depreciation Tracking' }, // new
    ];

    const result = (await routeAction('syncPrdEngines', nonAdminToken(), { processes: catalogue })) as {
      created: boolean;
      engine: any;
    };

    expect(result.created).toBe(true);
    expect(result.engine.title).toBe('Custom AI Orchestration Engine');
    expect(result.engine.overlappingProcesses).toEqual([
      'Payroll Reconciliation for Contract Nurses',
      'Medical Equipment Depreciation Tracking',
    ]);

    // Persisted: an independent, later list call (a "new session") sees it.
    const afterSync = (await routeAction('listPrdEngines', adminToken())) as any[];
    expect(afterSync).toHaveLength(SEED_PRD_ENGINES.length + 1);
    const persisted = afterSync.find((e) => e.id === result.engine.id);
    expect(persisted).toBeDefined();
    expect(persisted.overlappingProcesses).toEqual(result.engine.overlappingProcesses);

    // Running sync again with the same catalogue is now a no-op — those
    // processes are mapped by the engine we just persisted.
    const second = (await routeAction('syncPrdEngines', nonAdminToken(), { processes: catalogue })) as {
      created: boolean;
    };
    expect(second.created).toBe(false);
  });

  it('rejects requests with no token', async () => {
    await expect(routeAction('syncPrdEngines', undefined, { processes: [] })).rejects.toThrow();
  });
});
