import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CaseDetailsFields } from '@/components/case/CaseDetailsFields';
import { CategoryField } from '@/components/case/CategoryField';
import { IdentityFields } from '@/components/case/IdentityFields';
import { NarrationField } from '@/components/case/NarrationField';
import { Button } from '@/components/ui/button';
import { ErrorSummary, errorFor } from '@/components/ui/error-summary';
import { Sheet } from '@/components/ui/sheet';
import { api, type CaseUnit } from '@/lib/api';
import {
  buildFacts,
  caseFormFromUnit,
  detailSummary,
  draftFromFacts,
  emptyCaseForm,
  parseSentenceInput,
  validateIdentity,
  validateNarration,
  type CaseFormState,
  type FieldError,
} from '@/lib/case-form';
import { copy } from '@/lib/copy';
import { bestUnit, formatDayCount, type DurationUnit } from '@/lib/duration';
import { notifyIndexChanged } from '@/lib/index-status';
import { SentenceInput } from './SentenceInput';

const PREFIX = 'case-editor';

interface CaseEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when adding a perkara. */
  unit?: CaseUnit;
  onSaved: (unit: CaseUnit) => void;
}

/** Same fields as Estimasi, plus identity and the actual ruling. */
export function CaseEditor({ open, onOpenChange, unit, onSaved }: CaseEditorProps) {
  const [form, setForm] = useState<CaseFormState>(emptyCaseForm);
  const [amount, setAmount] = useState('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('bulan');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(unit === undefined ? emptyCaseForm() : caseFormFromUnit(unit));
    const days = unit?.outcome.actualSentenceDays ?? null;
    const prefill = days === null ? { amount: '', unit: 'bulan' as DurationUnit } : bestUnit(days);
    setAmount(prefill.amount);
    setDurationUnit(prefill.unit);
    setErrors([]);
    setFailure(null);
  }, [open, unit]);

  const preview = useMemo(() => {
    const days = parseSentenceInput(amount, durationUnit, 'outcome', false, []);
    return days === null ? null : `= ${formatDayCount(days)}`;
  }, [amount, durationUnit]);

  const patch = (changes: Partial<CaseFormState>) => setForm((current) => ({ ...current, ...changes }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: FieldError[] = [];
    validateIdentity(form, found);
    validateNarration(form, found);
    const facts = buildFacts(form, found);
    const days = parseSentenceInput(amount, durationUnit, 'outcome', false, found);
    setErrors(found);
    if (found.length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      const draft = draftFromFacts(facts, form, days);
      const saved = unit === undefined ? await api.createCase(draft) : await api.updateCase(unit.id, draft);
      notifyIndexChanged();
      onSaved(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'server tidak menjawab';
      setFailure(`Perkara belum tersimpan: ${message}. Periksa isian, lalu coba lagi.`);
    } finally {
      setSaving(false);
    }
  };

  const fields = { idPrefix: PREFIX, form, patch, errors, disabled: saving };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={unit === undefined ? copy.cases.createTitle : copy.cases.editTitle}
      description={unit === undefined ? undefined : unit.identity.caseNumber}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" form={`${PREFIX}-form`} variant="primary" disabled={saving}>
            {saving ? copy.actual.saving : copy.cases.saveCase}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {copy.actual.cancel}
          </Button>
        </div>
      }
    >
      <form id={`${PREFIX}-form`} noValidate onSubmit={submit} className="space-y-8">
        <ErrorSummary title={copy.estimate.errorSummaryTitle} errors={errors} idPrefix={PREFIX} />
        <IdentityFields idPrefix={PREFIX} value={form} onChange={patch} errors={errors} disabled={saving} />
        <NarrationField {...fields} />
        <CategoryField {...fields} unknownLabel="Belum diketahui" />
        <CaseDetailsFields {...fields} defaultOpen={unit !== undefined && detailSummary(caseFormFromUnit(unit)).length > 0} />
        <SentenceInput
          id={`${PREFIX}-outcome`}
          label="Putusan aktual (opsional)"
          hint="Kosongkan bila hukumannya belum diketahui."
          amount={amount}
          unit={durationUnit}
          onAmountChange={setAmount}
          onUnitChange={setDurationUnit}
          preview={preview}
          error={errorFor(errors, 'outcome')}
          disabled={saving}
        />
        {failure === null ? null : (
          <p role="alert" className="text-[15px] font-medium text-danger">
            {failure}
          </p>
        )}
      </form>
    </Sheet>
  );
}
