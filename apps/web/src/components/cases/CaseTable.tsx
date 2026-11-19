import type { CaseUnitSummary } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatSentence } from '@/lib/duration';
import { formatDate } from '@/lib/format';
import { caseHref } from '@/lib/route';
import { categoryDisplay } from '@/lib/vocabulary';

function sentence(days: number | null): string {
  return days === null ? '—' : formatSentence(days);
}

/** Dense table on desktop, stacked list on phones; only row dividers, no boxes. */
export function CaseTable({ items }: { items: CaseUnitSummary[] }) {
  const columns = copy.cases.columns;
  return (
    <>
      <table className="hidden w-full text-left text-[15px] md:table">
        <thead className="text-[13px] text-ink-subtle">
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 pr-4 font-normal">{columns.caseNumber}</th>
            <th scope="col" className="py-2 pr-4 font-normal">{columns.court}</th>
            <th scope="col" className="py-2 pr-4 font-normal">{columns.category}</th>
            <th scope="col" className="py-2 pr-4 font-normal">{columns.narration}</th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">{columns.sentence}</th>
            <th scope="col" className="py-2 text-right font-normal">{columns.updated}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {items.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer transition-colors hover:bg-surface"
              onClick={() => {
                window.location.hash = caseHref(item.id);
              }}
            >
              <td className="py-3 pr-4">
                <a href={caseHref(item.id)} className="tabular font-medium text-ink underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>
                  {item.caseNumber}
                </a>
              </td>
              <td className="py-3 pr-4 text-ink-muted">{item.court}</td>
              <td className="py-3 pr-4 text-ink-muted">{categoryDisplay(item.category)}</td>
              <td className="max-w-[26rem] py-3 pr-4 text-sm text-ink-muted">
                {item.narrationPreview === null ? '—' : item.narrationPreview}
              </td>
              <td className="tabular whitespace-nowrap py-3 pr-4 text-right text-ink">{sentence(item.actualSentenceDays)}</td>
              <td className="tabular whitespace-nowrap py-3 text-right text-ink-subtle">{formatDate(item.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-rule border-t border-rule md:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <a href={caseHref(item.id)} className="block space-y-1 py-4">
              <span className="tabular block font-medium text-ink">{item.caseNumber}</span>
              <span className="block text-sm text-ink-muted">
                {[item.court, categoryDisplay(item.category)].join(' · ')}
              </span>
              {item.narrationPreview === null ? null : (
                <span className="block text-sm text-ink-subtle">{item.narrationPreview}</span>
              )}
              <span className="tabular flex justify-between text-sm">
                <span className="text-ink">{sentence(item.actualSentenceDays)}</span>
                <span className="text-ink-subtle">{formatDate(item.updatedAt)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
