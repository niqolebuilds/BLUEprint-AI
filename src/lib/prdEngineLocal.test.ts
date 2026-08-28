import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrdEngines, deletePrdEngineLocal, syncPrdEnginesLocal, PRD_ENGINE_STORAGE_KEY, StorageLike } from './prdEngineLocal';
import { SEED_PRD_ENGINES } from '../data/prdEngineSeed';

/** Simple in-memory Storage stand-in — a fresh instance per test simulates a fresh page load. */
function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('loadPrdEngines', () => {
  it('seeds an empty store exactly once', () => {
    const storage = createMemoryStorage();
    const first = loadPrdEngines(storage);
    expect(first).toHaveLength(SEED_PRD_ENGINES.length);

    // Simulate remounting the component (PRDHub used to reset to BASE_ENGINES
    // on every mount) — loading again must return the same persisted data,
    // not re-seed.
    const second = loadPrdEngines(storage);
    expect(second).toHaveLength(SEED_PRD_ENGINES.length);
    expect(storage.getItem(PRD_ENGINE_STORAGE_KEY)).toBeTruthy();
  });
});

describe('deletePrdEngineLocal — Symptom 1 (deletes must persist)', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = createMemoryStorage();
    loadPrdEngines(storage); // seed
  });

  it('removes the engine and it stays gone across a simulated remount/reload', () => {
    const before = loadPrdEngines(storage);
    const target = before[0];

    deletePrdEngineLocal(storage, target.id);

    // A fresh call against the same storage — like a new mount after
    // navigating away and back, or reloading the page.
    const afterReload = loadPrdEngines(storage);
    expect(afterReload.find((e) => e.id === target.id)).toBeUndefined();
    expect(afterReload).toHaveLength(before.length - 1);

    // And a second reload doesn't resurrect it either.
    const afterSecondReload = loadPrdEngines(storage);
    expect(afterSecondReload).toHaveLength(before.length - 1);
  });

  it('deleting every engine leaves an empty (not re-seeded) list', () => {
    let current = loadPrdEngines(storage);
    for (const e of current) {
      current = deletePrdEngineLocal(storage, e.id);
    }
    expect(current).toHaveLength(0);
    expect(loadPrdEngines(storage)).toHaveLength(0);
  });
});

describe('syncPrdEnginesLocal — Symptom 2 (sync must generate + persist)', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = createMemoryStorage();
    loadPrdEngines(storage); // seed
  });

  it('does nothing when every catalogue process is already mapped', () => {
    const seeded = loadPrdEngines(storage);
    const alreadyMapped = seeded.flatMap((e) => e.overlappingProcesses).map((title) => ({ title }));

    const result = syncPrdEnginesLocal(storage, alreadyMapped);

    expect(result.created).toBe(false);
    expect(result.engine).toBeNull();
  });

  it('generates a new engine and persists it across a simulated remount', () => {
    const catalogue = [
      { id: 'p1', title: 'Monthly VAT & PPN Taxation Filing' }, // already mapped
      { id: 'p2', title: 'Ad-Hoc Grant Reporting for Research Unit' }, // new
    ];

    const result = syncPrdEnginesLocal(storage, catalogue, { idFactory: () => 'engine-test-id' });
    expect(result.created).toBe(true);
    expect(result.engine?.overlappingProcesses).toEqual(['Ad-Hoc Grant Reporting for Research Unit']);

    // Persisted: a fresh load (new mount) sees it.
    const afterReload = loadPrdEngines(storage);
    expect(afterReload).toHaveLength(SEED_PRD_ENGINES.length + 1);
    expect(afterReload.find((e) => e.id === 'engine-test-id')).toBeDefined();
  });
});
