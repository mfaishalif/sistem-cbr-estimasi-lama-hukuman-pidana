import { Field, describedBy } from '@/components/ui/field';
import { errorFor } from '@/components/ui/error-summary';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/toggle-group';
import type { CaseFormState } from '@/lib/case-form';
import { GENDERS, PRIOR_CONVICTION, humanizeSlug } from '@/lib/vocabulary';
import { FORM_GRID, SECTION_BODY, SECTION_HEADING, span } from './layout';
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
    <fieldset>
      <legend className={SECTION_HEADING}>Terdakwa</legend>
      <div className={`${SECTION_BODY} ${FORM_GRID}`}>
        <Field id={`${idPrefix}-gender`} label="Jenis kelamin" asGroup className={span.full}>
          <Segmented
            value={form.gender}
            onChange={(gender) => patch({ gender })}
            options={genderOptions}
            ariaLabelledBy={`${idPrefix}-gender-label`}
            disabled={disabled}
          />
        </Field>

        {/* Umur and tanggal each take their own row, so neither leaves a ragged edge. */}
        <Field id={`${idPrefix}-age`} label="Umur (tahun)" error={ageError} className={span.age}>
          <Input
            id={`${idPrefix}-age`}
            inputMode="numeric"
            value={form.ageYears}
            onChange={(event) => patch({ ageYears: event.target.value.replace(/[^\d]/g, '') })}
            aria-invalid={ageError === undefined ? undefined : true}
            aria-describedby={describedBy(`${idPrefix}-age`, { error: ageError })}
            className="tabular"
            autoComplete="off"
            disabled={disabled}
          />
        </Field>
        {form.ageYears.trim() === '' ? null : (
          <Field
            id={`${idPrefix}-age-date`}
            label="Tanggal penangkapan"
            hint="Umur hanya dibandingkan dengan putusan yang tanggal penangkapannya berdekatan."
            error={dateError}
            className={`${span.date} col-start-1`}
          >
            <Input
              id={`${idPrefix}-age-date`}
              type="date"
              value={form.ageReferenceDate}
              onChange={(event) => patch({ ageReferenceDate: event.target.value })}
              aria-invalid={dateError === undefined ? undefined : true}
              aria-describedby={describedBy(`${idPrefix}-age-date`, { hint: true, error: dateError })}
              aria-required
              className="tabular"
              autoComplete="off"
              disabled={disabled}
            />
          </Field>
        )}

        <Field id={`${idPrefix}-education`} label="Pendidikan" className="col-span-6 col-start-1">
          <Input
            id={`${idPrefix}-education`}
            value={form.education}
            onChange={(event) => patch({ education: event.target.value })}
            placeholder="Misalnya SMA"
            autoComplete="off"
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-occupation`} label="Pekerjaan" className="col-span-6">
          <Input
            id={`${idPrefix}-occupation`}
            value={form.occupation}
            onChange={(event) => patch({ occupation: event.target.value })}
            placeholder="Misalnya swasta"
            autoComplete="off"
            disabled={disabled}
          />
        </Field>

        <Field id={`${idPrefix}-prior`} label="Riwayat dihukum" asGroup className={span.full}>
          <Segmented<CaseFormState['priorConviction']>
            value={form.priorConviction}
            onChange={(priorConviction) => patch({ priorConviction })}
            options={[{ value: '', label: UNKNOWN.label }, ...PRIOR_CONVICTION]}
            ariaLabelledBy={`${idPrefix}-prior-label`}
            disabled={disabled}
          />
        </Field>
      </div>
    </fieldset>
  );
}
