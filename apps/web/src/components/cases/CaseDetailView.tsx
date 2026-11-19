import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { CaseSource, CaseUnit } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatDayCount, formatSentence } from '@/lib/duration';
import { ATTRIBUTE_ORDER, formatArticle, recordedFacts } from '@/lib/facts';
import { formatDate } from '@/lib/format';
import { categoryLabel } from '@/lib/vocabulary';
import { OutcomeEditor } from './OutcomeEditor';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-heading text-lg font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Pairs({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[10rem_1fr]">
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-subtle">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-start gap-3">
      <code className="tabular min-w-0 flex-1 break-all font-sans text-sm text-ink-muted">{value}</code>
      <Button variant="ghost" size="sm" onClick={() => void copyValue()} aria-label={`Salin ${value}`}>
        {copied ? copy.cases.copied : copy.cases.copy}
      </Button>
    </div>
  );
}

function SourceItem({ source }: { source: CaseSource }) {
  return (
    <li className="space-y-1">
      <CopyValue value={source.snapshotPath} />
      {source.sourceUrl === null ? null : (
        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-accent underline underline-offset-4">
          {source.sourceUrl}
        </a>
      )}
    </li>
  );
}

/** Kronologi → Pasal → Detail → Putusan → Sumber → Identitas. */
export function CaseDetailView({ unit, onUnitChange }: { unit: CaseUnit; onUnitChange: (unit: CaseUnit) => void }) {
  const [editingOutcome, setEditingOutcome] = useState(false);
  const facts = recordedFacts(unit.facts.attributes);
  const articles = unit.facts.articles ?? [];
  const days = unit.outcome.actualSentenceDays;

  return (
    <div className="space-y-10">
      <Section title="Kronologi perkara">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">{unit.facts.narration}</p>
      </Section>

      <Section title="Pasal dakwaan">
        {articles.length === 0 ? (
          <p className="text-[15px] text-ink-subtle">Pasal dakwaan tidak tercatat.</p>
        ) : (
          <ul className="tabular space-y-1 text-[15px] text-ink">
            {articles.map((article, index) => (
              <li key={`${article.law}-${article.article}-${index}`}>{formatArticle(article)}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Detail perkara">
        {facts.length === 0 ? (
          <p className="text-[15px] text-ink-subtle">{copy.cases.noDetails}.</p>
        ) : (
          <>
            <Pairs items={facts.map((fact) => [fact.label, fact.value])} />
            {facts.length < ATTRIBUTE_ORDER.length ? <p className="text-sm text-ink-subtle">{copy.cases.otherDetailsMissing}.</p> : null}
          </>
        )}
      </Section>

      <Section title="Putusan">
        {editingOutcome ? (
          <OutcomeEditor
            unit={unit}
            onCancel={() => setEditingOutcome(false)}
            onSaved={(saved) => {
              setEditingOutcome(false);
              onUnitChange(saved);
            }}
          />
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            {days === null ? (
              <p className="text-[15px] text-ink-subtle">{copy.cases.noOutcome}</p>
            ) : (
              <p className="font-heading text-3xl font-semibold text-ink">
                {formatSentence(days)}
                <span className="tabular ml-3 font-sans text-sm font-normal text-ink-subtle">{formatDayCount(days)}</span>
              </p>
            )}
            <Button size="sm" onClick={() => setEditingOutcome(true)}>
              {copy.cases.editOutcome}
            </Button>
          </div>
        )}
      </Section>

      <Section title="Sumber">
        {unit.sources.length === 0 ? (
          <p className="text-[15px] text-ink-subtle">Ditambahkan langsung di aplikasi, tanpa dokumen sumber.</p>
        ) : (
          <ul className="space-y-3">
            {unit.sources.map((source) => (
              <SourceItem key={source.sourceDocumentId} source={source} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Identitas">
        <Pairs
          items={[
            ['Pengadilan', unit.identity.court],
            ['Nomor perkara', <span className="tabular">{unit.identity.caseNumber}</span>],
            ['Nama terdakwa', unit.identity.defendantName ?? '—'],
            ['Kategori', categoryLabel(unit.facts.category) ?? '—'],
            ['Ditambahkan', formatDate(unit.createdAt)],
            ['Diperbarui', formatDate(unit.updatedAt)],
          ]}
        />
      </Section>
    </div>
  );
}
