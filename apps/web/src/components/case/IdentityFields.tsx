import { errorFor } from '@/components/ui/error-summary';
import { Field, describedBy } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { FieldError, IdentityInput } from '@/lib/case-form';
import { copy } from '@/lib/copy';

interface IdentityFieldsProps {
  idPrefix: string;
  value: IdentityInput;
  onChange: (changes: Partial<IdentityInput>) => void;
  errors: FieldError[];
  disabled?: boolean;
}

/** Pengadilan, nomor perkara, nama terdakwa. Never used as a similarity feature. */
export function IdentityFields({ idPrefix, value, onChange, errors, disabled }: IdentityFieldsProps) {
  const field = (key: keyof IdentityInput, errorKey: string, label: string, required: boolean) => {
    const id = `${idPrefix}-${errorKey}`;
    const error = errorFor(errors, errorKey);
    return (
      <Field id={id} label={label} error={error}>
        <Input
          id={id}
          value={value[key]}
          onChange={(event) => onChange({ [key]: event.target.value })}
          placeholder={key === 'court' ? 'PN Jakarta Selatan' : key === 'caseNumber' ? '12/Pid.B/2024/PN Jkt.Sel' : undefined}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={[describedBy(id, { error }), `${idPrefix}-identity-hint`].filter(Boolean).join(' ')}
          aria-required={required || undefined}
          className={key === 'caseNumber' ? 'tabular' : undefined}
          disabled={disabled}
        />
      </Field>
    );
  };

  return (
    <fieldset className="space-y-4">
      <legend className="text-[15px] font-semibold text-ink">
        {copy.identity.title}
      </legend>
      <p id={`${idPrefix}-identity-hint`} className="text-sm text-ink-subtle">
        {copy.identity.hint}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('court', 'court', copy.actual.courtLabel, true)}
        {field('caseNumber', 'case-number', copy.actual.caseNumberLabel, true)}
        {field('defendantName', 'defendant', copy.actual.defendantLabel, false)}
      </div>
    </fieldset>
  );
}
