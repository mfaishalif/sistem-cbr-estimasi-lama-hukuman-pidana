import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SentenceInput } from '@/components/cases/SentenceInput';
import { Button } from '@/components/ui/button';
import type { CaseFacts } from '@/lib/api';
import { parseSentenceInput, type FieldError } from '@/lib/case-form';
import { copy } from '@/lib/copy';
import { formatDayCount, type DurationUnit } from '@/lib/duration';
import { comparisonSentence } from '@/lib/estimate';
import { caseHref } from '@/lib/route';
import { RetainForm } from './RetainForm';

interface ActualRulingProps {
  estimateDays: number | null;
  facts: CaseFacts;
  stale: boolean;
  onActualChange: (days: number | null) => void;
}

/** Revise (compare) and Retain (store) in one section. */
export function ActualRuling({ estimateDays, facts, stale, onActualChange }: ActualRulingProps) {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<DurationUnit>('bulan');
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const errors: FieldError[] = [];
    const days = parseSentenceInput(amount, unit, 'actual', false, errors);
    return { days, error: errors[0]?.message };
  }, [amount, unit]);

  useEffect(() => onActualChange(parsed.days), [parsed.days, onActualChange]);

  const comparison = parsed.days === null ? null : comparisonSentence(estimateDays, parsed.days);
  const locked = savedId !== null;

  return (
    <section aria-labelledby="actual-title" className="space-y-5 border-t border-rule pt-8">
      <div className="space-y-1">
        <h3 id="actual-title" className="font-heading text-xl font-semibold text-ink">
          {copy.actual.title}
        </h3>
        <p className="text-[15px] text-ink-muted">{copy.actual.note}</p>
      </div>

      <SentenceInput
        id="actual-amount"
        label={copy.actual.amountLabel}
        amount={amount}
        unit={unit}
        onAmountChange={setAmount}
        onUnitChange={setUnit}
        preview={parsed.days === null ? null : `= ${formatDayCount(parsed.days)}`}
        error={parsed.error}
        disabled={locked}
      />
      {comparison === null ? null : (
        <p className="text-[15px] text-ink" aria-live="polite">
          {comparison}
        </p>
      )}

      {locked ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-positive" role="status">
          <CheckCircle2 className="size-4" aria-hidden />
          {copy.actual.saved}
          <a href={caseHref(savedId)} className="font-medium underline underline-offset-4">
            {copy.actual.viewSaved}
          </a>
        </p>
      ) : saveOpen && parsed.days !== null && !stale ? (
        <RetainForm
          facts={facts}
          actualDays={parsed.days}
          onCancel={() => setSaveOpen(false)}
          onSaved={(id) => {
            setSavedId(id);
            setSaveOpen(false);
          }}
        />
      ) : (
        <div className="space-y-2">
          <Button onClick={() => setSaveOpen(true)} disabled={parsed.days === null || stale} aria-describedby={stale ? 'actual-stale-note' : undefined}>
            {copy.actual.save}
          </Button>
          {stale ? (
            <p id="actual-stale-note" className="text-sm text-caution">
              {copy.actual.staleBlocked}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
