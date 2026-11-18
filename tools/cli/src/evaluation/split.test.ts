import { describe, expect, it } from 'vitest';
import { buildSplitManifest, type SplitUnit } from './split';

const proportions = { training: 0.6, validation: 0.2, test: 0.2 };

const units: SplitUnit[] = [
  { id: 'A1', caseGroupId: 'group-a' },
  { id: 'A2', caseGroupId: 'group-a' },
  { id: 'B1', caseGroupId: 'group-b' },
  { id: 'C1', caseGroupId: 'group-c' },
  { id: 'D1', caseGroupId: 'group-d' },
  { id: 'E1', caseGroupId: 'group-e' },
  { id: 'F1', caseGroupId: 'group-f' },
  { id: 'G1', caseGroupId: 'group-g' },
  { id: 'H1', caseGroupId: 'group-h' },
  { id: 'I1', caseGroupId: 'group-i' },
];

describe('buildSplitManifest', () => {
  it('assigns every unit exactly once and keeps one case group in one split', () => {
    const manifest = buildSplitManifest(units, { seed: 'uji-24', proportions });

    const assignedIds = manifest.assignments.map((assignment) => assignment.id).sort();
    expect(assignedIds).toEqual(units.map((unit) => unit.id).sort());

    const byId = new Map(manifest.assignments.map((assignment) => [assignment.id, assignment]));
    expect(byId.get('A1')?.split).toBe(byId.get('A2')?.split);
    expect(byId.get('A1')?.caseGroupId).toBe('group-a');

    const groupCounts = Object.values(manifest.groups).flat();
    expect(groupCounts).toHaveLength(9);
    expect(new Set(groupCounts).size).toBe(9);
  });

  it('produces the same split when the input order changes', () => {
    const first = buildSplitManifest(units, { seed: 'uji-24', proportions });
    const shuffled = [...units].reverse();
    const second = buildSplitManifest(shuffled, { seed: 'uji-24', proportions });

    expect(second).toEqual(first);
  });

  it('reports empty splits instead of hiding them', () => {
    const manifest = buildSplitManifest(
      [
        { id: 'X1', caseGroupId: 'one-case' },
        { id: 'X2', caseGroupId: 'one-case' },
      ],
      { seed: 'uji-24', proportions },
    );

    expect(manifest.emptySplits).toHaveLength(2);
    expect(manifest.units.training.length + manifest.units.validation.length + manifest.units.test.length).toBe(2);
    expect(manifest.summary.training.unitProportion + manifest.summary.validation.unitProportion + manifest.summary.test.unitProportion).toBe(1);

    const empty = buildSplitManifest([], { seed: 'uji-24', proportions });
    expect(empty.assignments).toEqual([]);
    expect(empty.emptySplits).toEqual(['training', 'validation', 'test']);
    expect(empty.summary.training.unitProportion).toBe(0);
  });

  it('allocates units close to the requested proportions without splitting groups', () => {
    const manifest = buildSplitManifest(units, { seed: 'uji-24', proportions });

    expect(manifest.summary.training.unitCount).toBe(6);
    expect(manifest.summary.validation.unitCount).toBe(2);
    expect(manifest.summary.test.unitCount).toBe(2);
    expect(manifest.emptySplits).toEqual([]);
  });

  it('accepts a numeric seed', () => {
    const manifest = buildSplitManifest(units, { seed: 24, proportions });
    expect(manifest.seed).toBe('24');
    expect(manifest.assignments).toHaveLength(units.length);
  });

  it('rejects duplicate units, empty seeds, and invalid proportions', () => {
    expect(() =>
      buildSplitManifest(
        [
          { id: 'A1', caseGroupId: 'group-a' },
          { id: 'A1', caseGroupId: 'group-b' },
        ],
        { seed: 'uji-24', proportions },
      ),
    ).toThrow(/duplikat/);

    expect(() => buildSplitManifest(units, { seed: '  ', proportions })).toThrow(/seed/i);
    expect(() =>
      buildSplitManifest(units, {
        seed: 'uji-24',
        proportions: { training: 0.6, validation: 0.2, test: 0.3 },
      }),
    ).toThrow(/jumlah proporsi/i);
    expect(() =>
      buildSplitManifest(units, {
        seed: 'uji-24',
        proportions: { training: 1.2, validation: -0.1, test: -0.1 },
      }),
    ).toThrow(/0\.\.1/);
  });
});
