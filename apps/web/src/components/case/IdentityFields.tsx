import { errorFor } from '@/components/ui/error-summary';
import { Field, describedBy } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Hint } from '@/components/ui/label';
import type { FieldError, IdentityInput } from '@/lib/case-form';
import { copy } from '@/lib/copy';
import { FORM_GRID, SECTION_BODY, SECTION_HEADING, span } from './layout';

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
      <Field id={id} label={label} error={error} className={key === 'defendantName' ? `${span.half} col-start-1` : span.half}>
        <Input
          id={id}
          value={value[key]}
          onChange={(event) => onChange({ [key]: event.target.value })}
          placeholder={key === 'court' ? 'PN Jakarta Selatan' : key === 'caseNumber' ? '12/Pid.B/2024/PN Jkt.Sel' : undefined}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={[describedBy(id, { error }), `${idPrefix}-identity-hint`].filter(Boolean).join(' ')}
          aria-required={required || undefined}
          className={key === 'caseNumber' ? 'tabular' : undefined}
          autoComplete="off"
          disabled={disabled}
        />
      </Field>
    );
  };

  return (
    <fieldset className="@container">
      <legend className={SECTION_HEADING}>{copy.identity.title}</legend>
      <Hint id={`${idPrefix}-identity-hint`} className="mt-1.5">
        {copy.identity.hint}
      </Hint>
      <div className={`${SECTION_BODY} ${FORM_GRID}`}>
        {field('court', 'court', copy.actual.courtLabel, true)}
        {field('caseNumber', 'case-number', copy.actual.caseNumberLabel, true)}
        {field('defendantName', 'defendant', copy.actual.defendantLabel, false)}
      </div>
    </fieldset>
  );
}
