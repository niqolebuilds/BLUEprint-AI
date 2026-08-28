import { describe, it, expect } from 'vitest';
import { computeUnmappedProcesses, generatePrdEngine, SEED_PRD_ENGINES } from './prdEngine';

describe('computeUnmappedProcesses', () => {
  it('excludes processes already referenced by an existing engine', () => {
    const existing = [{ overlappingProcesses: ['BPJS Claims Submission & Reconciliation'] }];
    const catalogue = [
      { id: 'p1', title: 'BPJS Claims Submission & Reconciliation' },
      { id: 'p2', title: 'New Unmapped Process' },
    ];
    const result = computeUnmappedProcesses(existing, catalogue);
    expect(result).toEqual([{ id: 'p2', title: 'New Unmapped Process' }]);
  });

  it('drops blank titles', () => {
    const result = computeUnmappedProcesses([], [{ id: 'p1', title: '   ' }, { id: 'p2', title: 'Real Process' }]);
    expect(result.map((p) => p.title)).toEqual(['Real Process']);
  });
});

describe('generatePrdEngine (the generation pipeline step)', () => {
  it('produces nothing when every catalogue process is already mapped', () => {
    const existing = SEED_PRD_ENGINES.map((e) => ({ overlappingProcesses: e.overlappingProcesses }));
    const catalogue = SEED_PRD_ENGINES.flatMap((e) => e.overlappingProcesses.map((title) => ({ title })));

    const result = generatePrdEngine(existing, catalogue);

    expect(result.created).toBe(false);
    expect(result.engine).toBeNull();
  });

  it('compiles a new engine from unmapped catalogue processes and is fully deterministic given injected id/time', () => {
    const existing = [{ overlappingProcesses: ['Monthly VAT & PPN Taxation Filing'] }];
    const catalogue = [
      { id: 'p1', title: 'Monthly VAT & PPN Taxation Filing' },
      { id: 'p2', title: 'Payroll Reconciliation for Contract Nurses' },
      { id: 'p3', title: 'Medical Equipment Depreciation Tracking' },
    ];

    const result = generatePrdEngine(existing, catalogue, {
      idFactory: () => 'engine-test-fixed-id',
      now: () => new Date('2026-08-10T00:00:00.000Z'),
    });

    expect(result.created).toBe(true);
    expect(result.unmappedCount).toBe(2);
    expect(result.engine).toMatchObject({
      id: 'engine-test-fixed-id',
      title: 'Custom AI Orchestration Engine',
      iconKey: 'Sparkles',
      isSeed: false,
      createdAt: '2026-08-10T00:00:00.000Z',
      overlappingProcesses: ['Payroll Reconciliation for Contract Nurses', 'Medical Equipment Depreciation Tracking'],
    });
  });

  it('never mutates the existing-engines input it is given', () => {
    const existing = [{ overlappingProcesses: ['A'] }];
    const before = JSON.stringify(existing);
    generatePrdEngine(existing, [{ title: 'B' }]);
    expect(JSON.stringify(existing)).toBe(before);
  });
});
