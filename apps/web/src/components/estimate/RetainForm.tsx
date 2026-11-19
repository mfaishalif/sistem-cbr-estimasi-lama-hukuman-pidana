import { useState, type FormEvent } from 'react';
import { IdentityFields } from '@/components/case/IdentityFields';
import { Button } from '@/components/ui/button';
import { ErrorSummary } from '@/components/ui/error-summary';
import { api, type CaseFacts } from '@/lib/api';
import { draftFromFacts, validateIdentity, type FieldError, type IdentityInput } from '@/lib/case-form';
import { copy } from '@/lib/copy';
import { formatSentence } from '@/lib/duration';
import { notifyIndexChanged } from '@/lib/index-status';

const PREFIX = 'retain';

interface RetainFormProps {
  facts: CaseFacts;
  actualDays: number;
  onCancel: () => void;
  onSaved: (id: string) => void;
}

/** Identity is only asked here, when saving. Stores the perkara with the exact estimated facts plus identity and the actual ruling. */
export function RetainForm({ facts, actualDays, onCancel, onSaved }: RetainFormProps) {
  const [identity, setIdentity] = useState<IdentityInput>({ court: '', caseNumber: '', defendantName: '' });
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: FieldError[] = [];
    validateIdentity(identity, found);
    setErrors(found);
    if (found.length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      const saved = await api.createCase(draftFromFacts(facts, identity, actualDays));
      notifyIndexChanged();
      onSaved(saved.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'server tidak menjawab';
      setFailure(`Putusan belum tersimpan: ${message}. Periksa isian, lalu coba lagi.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5 rounded-md bg-surface-sunken/60 px-4 py-5 sm:px-5">
      <p className="text-[15px] text-ink">
        Perkara ini disimpan dengan kronologi dan detail yang sama seperti saat estimasi, beserta putusan{' '}
        <span className="font-medium">{formatSentence(actualDays)}</span>.
      </p>
      <ErrorSummary title={copy.estimate.errorSummaryTitle} errors={errors} idPrefix={PREFIX} />
      <IdentityFields
        idPrefix={PREFIX}
        value={identity}
        onChange={(changes) => setIdentity((current) => ({ ...current, ...changes }))}
        errors={errors}
        disabled={saving}
      />
      {failure === null ? null : (
        <p role="alert" className="text-[15px] font-medium text-danger">
          {failure}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="border-ink bg-ink text-paper hover:bg-ink-muted" disabled={saving}>
          {saving ? copy.actual.saving : copy.actual.confirmSave}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {copy.actual.cancel}
        </Button>
      </div>
    </form>
  );
}
