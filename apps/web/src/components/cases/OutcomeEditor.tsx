import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { api, type CaseUnit } from '@/lib/api';
import { parseSentenceInput, type FieldError } from '@/lib/case-form';
import { copy } from '@/lib/copy';
import { bestUnit, formatDayCount, type DurationUnit } from '@/lib/duration';
import { notifyIndexChanged } from '@/lib/index-status';
import { SentenceInput } from './SentenceInput';

interface OutcomeEditorProps {
  unit: CaseUnit;
  onCancel: () => void;
  onSaved: (unit: CaseUnit) => void;
}

/** PATCH /api/cases/:id/outcome — only the stored actual ruling changes. */
export function OutcomeEditor({ unit, onCancel, onSaved }: OutcomeEditorProps) {
  const initial = unit.outcome.actualSentenceDays === null ? { amount: '', unit: 'bulan' as DurationUnit } : bestUnit(unit.outcome.actualSentenceDays);
  const [amount, setAmount] = useState(initial.amount);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initial.unit);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const days = parseSentenceInput(amount, durationUnit, 'outcome', false, []);
    return days === null ? null : `= ${formatDayCount(days)}`;
  }, [amount, durationUnit]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: FieldError[] = [];
    const days = parseSentenceInput(amount, durationUnit, 'outcome', true, errors);
    setError(errors[0]?.message);
    if (days === null) return;
    setSaving(true);
    try {
      const saved = await api.reviseOutcome(unit.id, days);
      notifyIndexChanged();
      onSaved(saved);
    } catch (caught) {
      setError(`Putusan belum tersimpan: ${caught instanceof Error ? caught.message : 'server tidak menjawab'}. Coba lagi.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <SentenceInput
        id="outcome-edit"
        label="Lama penjara dalam putusan"
        amount={amount}
        unit={durationUnit}
        onAmountChange={setAmount}
        onUnitChange={setDurationUnit}
        preview={preview}
        error={error}
        disabled={saving}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? copy.actual.saving : copy.cases.saveOutcome}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {copy.actual.cancel}
        </Button>
      </div>
    </form>
  );
}
