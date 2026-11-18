import type { CaseBaseCase, CaseFacts, FactValue } from '../src';

export interface FixtureCaseOptions {
  id: string;
  narration?: string;
  category?: string | null;
  outcomeDays?: number | null;
  caseGroupId?: string;
  attributes?: Record<string, FactValue>;
  articles?: CaseFacts['articles'];
}

/** Synthetic case used by the unit tests. No real verdict or person is involved. */
export function fixtureCase(options: FixtureCaseOptions): CaseBaseCase {
  const narration = options.narration ?? 'terdakwa mengambil sepeda motor milik korban';
  return {
    id: options.id,
    caseGroupId: options.caseGroupId ?? `group-${options.id}`,
    identity: {
      court: 'PN Sintetis',
      caseNumber: `${options.id}/Pid.B/2024/PN.Sintetis`,
      defendantName: null,
    },
    facts: {
      narration,
      category: options.category ?? null,
      articles: options.articles ?? [],
      attributes: options.attributes ?? {},
    },
    outcome: {
      actualSentenceDays:
        options.outcomeDays === undefined ? 360 : options.outcomeDays,
    },
    sources: [
      {
        sourceDocumentId: `source-${options.id}`,
        snapshotPath: `synthetic/${options.id}.xml`,
        narrationLocation: 'fakta',
        outcomeLocation: 'amar',
        aliases: [`synthetic/${options.id}.xml`],
      },
    ],
  };
}
