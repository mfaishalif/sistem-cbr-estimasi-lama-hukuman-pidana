import type { EstimateResult, ReferenceDetail } from './api';
import { formatDayCount, formatSentenceApprox } from './duration';
import { formatInteger, formatPercent } from './format';
import { articleKeyLabel, attributeLabel, categoryPhrase } from './vocabulary';

/** Pure explanations derived from `EstimateResult`; no extra data is requested. */

export interface ScorePart {
  key: 'narrative' | 'articles' | 'details';
  label: string;
  /** Share of the 0–1 score; the parts add up to `reference.score`. */
  value: number;
}

/**
 * score = Σ(weight × similarity) / Σ(weight of compared components), so each
 * component's part of the score is its contribution divided by the same
 * denominator. Attribute parts are summed into "Detail perkara".
 */
export function scoreParts(reference: ReferenceDetail): ScorePart[] {
  const totalWeight = reference.components.reduce((sum, component) => sum + component.weight, 0);
  if (!(totalWeight > 0)) return [];
  let narrative = 0;
  let articles = 0;
  let details = 0;
  let hasArticles = false;
  let hasDetails = false;
  for (const component of reference.components) {
    const part = component.contribution / totalWeight;
    if (component.kind === 'narrative') narrative += part;
    else if (component.kind === 'articles') {
      articles += part;
      hasArticles = true;
    } else {
      details += part;
      hasDetails = true;
    }
  }
  const parts: ScorePart[] = [{ key: 'narrative', label: 'Kronologi', value: narrative }];
  if (hasArticles) parts.push({ key: 'articles', label: 'Pasal dakwaan', value: articles });
  if (hasDetails) parts.push({ key: 'details', label: 'Detail perkara', value: details });
  return parts;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export interface ArticleMatch {
  compared: boolean;
  matched: string[];
  onlyQuery: string[];
  onlyRuling: string[];
}

export function articleMatch(reference: ReferenceDetail): ArticleMatch {
  const component = reference.components.find((item) => item.kind === 'articles');
  if (component?.detail === undefined) {
    return {
      compared: false,
      matched: [],
      onlyQuery: reference.comparison.missingCandidateArticleKeys.map(articleKeyLabel),
      onlyRuling: [],
    };
  }
  const query = stringList(component.detail.queryArticles);
  const ruling = stringList(component.detail.candidateArticles);
  const shared = new Set(stringList(component.detail.intersection));
  return {
    compared: true,
    matched: [...shared].map(articleKeyLabel),
    onlyQuery: query.filter((key) => !shared.has(key)).map(articleKeyLabel),
    onlyRuling: ruling.filter((key) => !shared.has(key)).map(articleKeyLabel),
  };
}

export function attributeComparisons(reference: ReferenceDetail): Array<{ key: string; label: string; similarity: number }> {
  return reference.components
    .filter((component) => component.kind === 'attribute')
    .map((component) => ({
      key: component.key,
      label: attributeLabel(component.key),
      similarity: component.similarity,
    }));
}

/** "Estimasi adalah rata-rata hukuman 5 putusan serupa, …. Putusan #1 berpengaruh 20%." */
export function weightingSentence(result: EstimateResult): string | null {
  const references = result.references;
  if (result.status !== 'estimated' || references.length === 0) return null;
  const top = [...references].sort((a, b) => b.reuse.weightShare - a.reuse.weightShare)[0]!;
  if (references.length === 1) {
    return 'Estimasi sama dengan hukuman satu-satunya putusan serupa yang memenuhi syarat.';
  }
  return `Estimasi adalah rata-rata hukuman ${formatInteger(references.length)} putusan serupa, ditimbang menurut tingkat kemiripannya. Putusan #${top.rank} berpengaruh ${formatPercent(top.reuse.weightShare)}.`;
}

/** "336 hari · dari 5 putusan serupa · kategori pencurian" */
export function resultMeta(result: EstimateResult): string {
  const parts: string[] = [];
  if (result.estimate.days !== null) parts.push(formatDayCount(result.estimate.days));
  parts.push(`dari ${formatInteger(result.references.length)} putusan serupa`);
  const category = categoryPhrase(result.category.requested);
  parts.push(
    result.category.restriction === 'same-category' && category !== null
      ? `kategori ${category}`
      : 'semua kategori',
  );
  return parts.join(' · ');
}

/** Revise sentence: "Selisih 36 hari lebih rendah dari estimasi (± 1 bulan)". */
export function comparisonSentence(estimateDays: number | null, actualDays: number): string | null {
  if (estimateDays === null) return null;
  const diff = actualDays - estimateDays;
  if (diff === 0) return 'Sama dengan estimasi.';
  const size = Math.abs(diff);
  const direction = diff < 0 ? 'lebih rendah' : 'lebih tinggi';
  const approx = size >= 30 ? ` (${formatSentenceApprox(size)})` : '';
  return `Selisih ${formatDayCount(size)} ${direction} dari estimasi${approx}.`;
}

export interface CandidateStep {
  label: string;
  count: number;
}

/** Human-readable candidate funnel for "Rincian perhitungan". */
export function candidateFlow(result: EstimateResult): CandidateStep[] {
  const c = result.scoring.candidates;
  const steps: CandidateStep[] = [
    { label: 'putusan dengan hukuman tercatat di basis kasus', count: c.eligibleCaseCount },
  ];
  if (c.searchScope === 'same-category') {
    steps.push({ label: 'dalam kategori yang sama', count: c.afterCategoryCount });
  }
  if (c.afterExclusionCount !== c.afterCategoryCount) {
    steps.push({ label: 'setelah perkara ini sendiri dikecualikan', count: c.afterExclusionCount });
  }
  steps.push({ label: 'dibandingkan', count: c.scoredCount });
  if (c.rejectedBelowScore > 0) {
    steps.push({ label: 'tidak dipakai karena kemiripan di bawah ambang', count: c.rejectedBelowScore });
  }
  if (c.rejectedCoverage > 0) {
    steps.push({ label: 'tidak dipakai karena detail perkara kurang lengkap untuk dibandingkan', count: c.rejectedCoverage });
  }
  steps.push({ label: 'dipakai untuk estimasi', count: c.selectedCount });
  return steps;
}

/** One-line funnel: "90 putusan dibandingkan → 5 dipakai". */
export function candidateSummary(result: EstimateResult): string {
  const c = result.scoring.candidates;
  return `${formatInteger(c.scoredCount)} putusan dibandingkan → ${formatInteger(c.selectedCount)} dipakai`;
}
