import { Field, describedBy } from '@/components/ui/field';
import { errorFor } from '@/components/ui/error-summary';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/toggle-group';
import type { CaseFormState } from '@/lib/case-form';
import { GENDERS, PRIOR_CONVICTION, humanizeSlug } from '@/lib/vocabulary';
import type { FieldsProps } from './types';

const UNKNOWN = { value: '', label: 'Belum diketahui' };

export function DefendantFields({ idPrefix, form, patch, errors, disabled }: FieldsProps) {
  const ageError = errorFor(errors, 'age');
  const dateError = errorFor(errors, 'age-date');
  const genderOptions = [UNKNOWN, ...GENDERS];
  if (form.gender !== '' && !GENDERS.some((option) => option.value === form.gender)) {
    genderOptions.push({ value: form.gender, label: humanizeSlug(form.gender) });
  }

  return (
    <fieldset className="space-y-5">
      <legend className="text-[15px] font-semibold text-ink">Terdakwa</legend>

      <Field id={`${idPrefix}-gender`} label="Jenis kelamin" asGroup>
        <Segmented
          value={form.gender}
          onChange={(gender) => patch({ gender })}
          options={genderOptions}
          ariaLabelledBy={`${idPrefix}-gender-label`}
          disabled={disabled}
        />
      </Field>

      {/* Stacked: the date's hint would push its input out of line with Umur in the narrow column. */}
      <div className="space-y-4">
        <Field id={`${idPrefix}-age`} label="Umur (tahun)" error={ageError} className="max-w-40">
          <Input
            id={`${idPrefix}-age`}
            inputMode="numeric"
            value={form.ageYears}
            onChange={(event) => patch({ ageYears: event.target.value.replace(/[^\d]/g, '') })}
            aria-invalid={ageError === undefined ? undefined : true}
            aria-describedby={describedBy(`${idPrefix}-age`, { error: ageError })}
            className="tabular"
            disabled={disabled}
          />
        </Field>
        {form.ageYears.trim() === '' ? null : (
          <Field
            id={`${idPrefix}-age-date`}
            label="Tanggal penangkapan"
            hint="Umur hanya dibandingkan dengan putusan yang tanggal penangkapannya berdekatan."
            error={dateError}
          >
            <Input
              id={`${idPrefix}-age-date`}
              type="date"
              value={form.ageReferenceDate}
              onChange={(event) => patch({ ageReferenceDate: event.target.value })}
              aria-invalid={dateError === undefined ? undefined : true}
              aria-describedby={describedBy(`${idPrefix}-age-date`, { hint: true, error: dateError })}
              aria-required
              className="max-w-56"
              disabled={disabled}
            />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idPrefix}-education`} label="Pendidikan">
          <Input
            id={`${idPrefix}-education`}
            value={form.education}
            onChange={(event) => patch({ education: event.target.value })}
            placeholder="Misalnya SMA"
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-occupation`} label="Pekerjaan">
          <Input
            id={`${idPrefix}-occupation`}
            value={form.occupation}
            onChange={(event) => patch({ occupation: event.target.value })}
            placeholder="Misalnya swasta"
            disabled={disabled}
          />
        </Field>
      </div>

      <Field id={`${idPrefix}-prior`} label="Riwayat dihukum" asGroup>
        <Segmented<CaseFormState['priorConviction']>
          value={form.priorConviction}
          onChange={(priorConviction) => patch({ priorConviction })}
          options={[{ value: '', label: UNKNOWN.label }, ...PRIOR_CONVICTION]}
          ariaLabelledBy={`${idPrefix}-prior-label`}
          disabled={disabled}
        />
      </Field>
    </fieldset>
  );
}
