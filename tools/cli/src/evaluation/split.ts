/**
 * Group-aware, deterministic splitting for CBR evaluation.
 *
 * One case group is the unit of assignment: every case unit that belongs to the
 * same case, copy of a verdict, or identified related case always lands in the
 * same split. The function is pure and accepts the seed and proportions from
 * the caller because the production values are still an open, data-driven
 * decision.
 */

import { assertUniqueUnitIds, compareIds } from './common';

export const SPLIT_NAMES = ['training', 'validation', 'test'] as const;

export type SplitName = (typeof SPLIT_NAMES)[number];

/** The only fields needed from the domain model's case unit. */
export interface SplitUnit {
  /** Stable case-unit ID from the domain model. */
  id: string;
  /** Case group ID from the domain model. */
  caseGroupId: string;
}

export interface SplitProportions {
  /** Target share of case units in training, validation, and test. */
  training: number;
  validation: number;
  test: number;
}

export interface SplitOptions {
  seed: string | number;
  proportions: SplitProportions;
}

export interface SplitAssignment extends SplitUnit {
  split: SplitName;
}

export interface SplitSummary {
  unitCount: number;
  groupCount: number;
  /** Share of all case units, in the range 0..1. */
  unitProportion: number;
}

export interface SplitManifest {
  seed: string;
  requestedProportions: SplitProportions;
  /** Sorted by unit ID so the manifest is stable for the same input. */
  assignments: SplitAssignment[];
  /** Sorted unit IDs per split. */
  units: Record<SplitName, string[]>;
  /** Sorted case group IDs per split. */
  groups: Record<SplitName, string[]>;
  summary: Record<SplitName, SplitSummary>;
  /** Splits with no units. The caller may stop the experiment when non-empty. */
  emptySplits: SplitName[];
}

function splitRecord<T>(factory: () => T): Record<SplitName, T> {
  return {
    training: factory(),
    validation: factory(),
    test: factory(),
  };
}

function assertProportions(proportions: SplitProportions): void {
  let sum = 0;
  for (const name of SPLIT_NAMES) {
    const value = proportions[name];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Proporsi ${name} harus berupa angka 0..1.`);
    }
    sum += value;
  }

  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Jumlah proporsi harus 1, diterima ${sum}.`);
  }
}

/** FNV-1a over the seed and group ID. Stable across platforms and runs. */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function targetUnitCounts(total: number, proportions: SplitProportions): Record<SplitName, number> {
  const exact = splitRecord(() => 0);
  const targets = splitRecord(() => 0);

  for (const name of SPLIT_NAMES) {
    exact[name] = total * proportions[name];
    targets[name] = Math.floor(exact[name]);
  }

  const remaining = total - SPLIT_NAMES.reduce((sum, name) => sum + targets[name], 0);
  const priority = SPLIT_NAMES.map((name, index) => ({
    name,
    fraction: exact[name] - targets[name],
    index,
  })).sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  // Largest-remainder allocation; fewer than one remainder per split.
  for (const entry of priority.slice(0, remaining)) {
    targets[entry.name] += 1;
  }

  return targets;
}

export function buildSplitManifest(units: readonly SplitUnit[], options: SplitOptions): SplitManifest {
  if (typeof options.seed === 'number' && !Number.isFinite(options.seed)) {
    throw new Error('Seed split harus berupa angka berhingga atau teks.');
  }
  const seed = String(options.seed);
  if (seed.trim() === '') {
    throw new Error('Seed split wajib diisi.');
  }
  assertProportions(options.proportions);
  assertUniqueUnitIds(
    units.map((unit) => unit.id),
    'ID unit kasus',
  );

  const unitsByGroup = new Map<string, string[]>();
  for (const unit of units) {
    if (unit.caseGroupId.trim() === '') {
      throw new Error(`Kelompok perkara untuk unit ${unit.id} wajib diisi.`);
    }
    const members = unitsByGroup.get(unit.caseGroupId);
    if (members === undefined) {
      unitsByGroup.set(unit.caseGroupId, [unit.id]);
    } else {
      members.push(unit.id);
    }
  }

  const orderedGroups = [...unitsByGroup.entries()]
    .map(([caseGroupId, unitIds]) => ({
      caseGroupId,
      unitIds: unitIds.sort(compareIds),
      rank: hash32(`${seed}\u0000${caseGroupId}`),
    }))
    .sort((left, right) => left.rank - right.rank || compareIds(left.caseGroupId, right.caseGroupId));

  const targets = targetUnitCounts(units.length, options.proportions);
  const assigned = splitRecord(() => 0);
  const assignments: SplitAssignment[] = [];

  for (const group of orderedGroups) {
    let chosen: SplitName = SPLIT_NAMES[0];
    let bestDeficit = targets[chosen] - assigned[chosen];

    for (const name of SPLIT_NAMES.slice(1)) {
      const deficit = targets[name] - assigned[name];
      if (deficit > bestDeficit) {
        chosen = name;
        bestDeficit = deficit;
      }
    }

    assigned[chosen] += group.unitIds.length;
    for (const unitId of group.unitIds) {
      assignments.push({ id: unitId, caseGroupId: group.caseGroupId, split: chosen });
    }
  }

  assignments.sort((left, right) => compareIds(left.id, right.id));

  const resultUnits = splitRecord<string[]>(() => []);
  const resultGroups = splitRecord<string[]>(() => []);
  for (const assignment of assignments) {
    resultUnits[assignment.split].push(assignment.id);
    if (!resultGroups[assignment.split].includes(assignment.caseGroupId)) {
      resultGroups[assignment.split].push(assignment.caseGroupId);
    }
  }
  for (const name of SPLIT_NAMES) {
    resultUnits[name].sort(compareIds);
    resultGroups[name].sort(compareIds);
  }

  const summary = splitRecord<SplitSummary>(() => ({
    unitCount: 0,
    groupCount: 0,
    unitProportion: 0,
  }));
  for (const name of SPLIT_NAMES) {
    summary[name] = {
      unitCount: resultUnits[name].length,
      groupCount: resultGroups[name].length,
      unitProportion: units.length === 0 ? 0 : resultUnits[name].length / units.length,
    };
  }

  const emptySplits = SPLIT_NAMES.filter((name) => summary[name].unitCount === 0);

  return {
    seed,
    requestedProportions: { ...options.proportions },
    assignments,
    units: resultUnits,
    groups: resultGroups,
    summary,
    emptySplits,
  };
}
