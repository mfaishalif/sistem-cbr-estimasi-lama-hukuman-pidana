import type { ReactNode } from 'react';
import { Disclosure } from '@/components/ui/disclosure';
import type { EstimateResult } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatDayCount } from '@/lib/duration';
import { candidateFlow, candidateSummary } from '@/lib/estimate';
import { formatDecimal, formatInteger, formatNumber, formatPercent } from '@/lib/format';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {children}
    </section>
  );
}

function Pairs({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-subtle">{term}</dt>
          <dd className="tabular text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The only place for technical detail: formula with real numbers, funnel, parameters, identifiers. */
export function CalculationDetails({ result }: { result: EstimateResult }) {
  const { estimate, scoring } = result;
  const references = [...result.references].sort((a, b) => a.rank - b.rank);

  return (
    <div className="border-t border-rule pt-6">
      <Disclosure title={copy.result.calculation} meta={candidateSummary(result)}>
        <div className="space-y-8 sm:pl-6">
          {estimate.numerator !== null && estimate.denominator !== null && estimate.rawDays !== null && estimate.days !== null ? (
            <Block title="Rumus estimasi">
              <p className="tabular rounded-md bg-surface-sunken px-4 py-3 text-[15px] leading-relaxed text-ink">
                estimasi = Σ(skor × hukuman) ÷ Σ(skor)
                <br />= {formatNumber(estimate.numerator, 1)} ÷ {formatNumber(estimate.denominator, 3)} ={' '}
                {formatNumber(estimate.rawDays, 1)} hari → {formatDayCount(estimate.days)}
              </p>
              <div className="overflow-x-auto">
                <table className="tabular w-full min-w-[26rem] text-left text-sm">
                  <thead className="text-[13px] text-ink-subtle">
                    <tr>
                      <th scope="col" className="py-1.5 pr-3 font-normal">Putusan</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-normal">Skor</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-normal">Hukuman</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-normal">Skor × hukuman</th>
                      <th scope="col" className="py-1.5 text-right font-normal">Pengaruh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule text-ink">
                    {references.map((reference) => (
                      <tr key={reference.caseUnitId}>
                        <td className="py-1.5 pr-3">#{reference.rank}</td>
                        <td className="py-1.5 pr-3 text-right">{formatDecimal(reference.reuse.weight, 3)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatDayCount(reference.actualSentenceDays)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatNumber(reference.reuse.weightedOutcomeDays, 1)}</td>
                        <td className="py-1.5 text-right">{formatPercent(reference.reuse.weightShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Block>
          ) : null}

          <Block title="Alur pemilihan putusan">
            <ol className="tabular space-y-1 text-sm text-ink">
              {candidateFlow(result).map((step) => (
                <li key={step.label}>
                  <span className="font-medium">{formatInteger(step.count)}</span> {step.label}
                </li>
              ))}
            </ol>
          </Block>

          <Block title="Parameter skor">
            <Pairs
              items={[
                ['Bobot kronologi', formatNumber(scoring.narrativeWeight)],
                ['Bobot pasal dakwaan', formatNumber(scoring.articleWeight)],
                ['Bobot detail perkara (total)', formatNumber(scoring.configuredAttributeWeight)],
                ['Putusan serupa maksimal', formatInteger(scoring.maxReferences)],
                ['Putusan serupa minimal', formatInteger(scoring.minReferences)],
                ['Ambang skor', `> ${formatNumber(scoring.minScore)}`],
                ['Ambang kelengkapan detail', `≥ ${formatPercent(scoring.minAttributeCoverage)}`],
                ['Pembatasan kategori', result.category.restriction === 'same-category' ? 'kategori yang sama' : 'semua kategori'],
              ]}
            />
          </Block>

          <Block title="Data teknis">
            <Pairs
              items={[
                ['Kata kronologi dikenali', `${formatInteger(result.query.recognizedTermCount)} dari ${formatInteger(result.query.tokenCount)}`],
                ['Sidik konfigurasi', scoring.configFingerprint],
                ['Generasi basis kasus', result.caseBaseGeneration === null ? '—' : formatInteger(result.caseBaseGeneration)],
                ...(result.withholding === null ? [] : ([['Kode penahanan', result.withholding.code]] as Array<[string, ReactNode]>)),
              ]}
            />
          </Block>
        </div>
      </Disclosure>
    </div>
  );
}
