import type { ReactNode } from 'react';
import { Chip } from '@/components/ui/chip';
import type { ReferenceDetail } from '@/lib/api';
import { copy } from '@/lib/copy';
import { articleMatch, attributeComparisons, scoreParts } from '@/lib/estimate';
import { formatDecimal, formatPercent } from '@/lib/format';
import { sharedTerms } from '@/lib/highlight';
import { caseHref } from '@/lib/route';
import { attributeLabel } from '@/lib/vocabulary';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-ink-subtle">{term}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function similarityWord(similarity: number): string {
  if (similarity >= 0.999) return 'sama';
  if (similarity <= 0.001) return 'berbeda';
  return `mirip ${formatPercent(similarity)}`;
}

export function SimilarityReasons({ reference, narration }: { reference: ReferenceDetail; narration: string }) {
  const parts = scoreParts(reference);
  const words = sharedTerms(narration, reference.facts.narration);
  const articles = articleMatch(reference);
  const attributes = attributeComparisons(reference);
  const missing = reference.comparison.missingCandidateAttributeKeys.map(attributeLabel);
  const queryHadDetails = reference.comparison.queryKnownWeight > 0;

  return (
    <div className="space-y-4 rounded-md bg-surface-sunken/60 px-4 py-4">
    <dl className="space-y-4">
      <Row term={`Skor ${formatDecimal(reference.score)} tersusun dari`}>
        <ul className="space-y-1.5">
          {parts.map((part) => (
            <li key={part.key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3">
              <span>{part.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <span
                  className="block h-full rounded-full bg-ink-muted"
                  style={{ width: `${reference.score > 0 ? Math.round((part.value / reference.score) * 100) : 0}%` }}
                />
              </span>
              <span className="tabular text-right">{formatDecimal(part.value)}</span>
            </li>
          ))}
        </ul>
      </Row>

      <Row term="Kata yang sama">
        {words.length === 0 ? (
          <span className="text-ink-subtle">Tidak ada kata yang sama selain kata umum.</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {words.map((word) => (
              <li key={word}>
                <Chip className="bg-accent-soft text-ink">{word}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Row>

      <Row term="Pasal dakwaan">
        {articles.compared ? (
          <span className="tabular space-y-0.5">
            <span className="block">Sama: {articles.matched.join(', ') || '—'}</span>
            {articles.onlyQuery.length > 0 ? <span className="block text-ink-muted">Hanya di perkara ini: {articles.onlyQuery.join(', ')}</span> : null}
            {articles.onlyRuling.length > 0 ? <span className="block text-ink-muted">Hanya di putusan ini: {articles.onlyRuling.join(', ')}</span> : null}
          </span>
        ) : articles.onlyQuery.length > 0 ? (
          <span className="text-ink-muted">Putusan ini tidak mencatat pasal dakwaan, jadi tidak dibandingkan.</span>
        ) : (
          <span className="text-ink-muted">Pasal dakwaan tidak diisi, jadi tidak dibandingkan.</span>
        )}
      </Row>

      <Row term="Detail perkara">
        {!queryHadDetails ? (
          <span className="text-ink-muted">Detail perkara tidak diisi, jadi tidak dibandingkan.</span>
        ) : (
          <span className="block space-y-0.5">
            {attributes.length > 0 ? (
              <span className="block">
                {attributes.map((item) => `${item.label} ${similarityWord(item.similarity)}`).join(' · ')}
              </span>
            ) : null}
            {missing.length > 0 ? <span className="block text-ink-muted">Tidak tercatat di putusan ini: {missing.join(', ')}</span> : null}
            <span className="tabular block text-ink-muted">Kelengkapan perbandingan {formatPercent(reference.comparison.coverage)}</span>
          </span>
        )}
      </Row>

      <Row term="Pengaruh terhadap estimasi">
        <span className="tabular">{formatPercent(reference.reuse.weightShare)}</span>
      </Row>
    </dl>

      <div>
        <a href={caseHref(reference.caseUnitId)} className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
          {copy.result.openInCases}
        </a>
      </div>
    </div>
  );
}
