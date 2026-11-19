import { ChipSelect } from '@/components/ui/chip';
import { Field, describedBy } from '@/components/ui/field';
import { errorFor } from '@/components/ui/error-summary';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatRupiahInput, rupiahDigits } from '@/lib/format';
import { ROLES, VICTIM_HARM, WEAPON_OR_MODE, humanizeSlug } from '@/lib/vocabulary';
import { FORM_GRID, SECTION_BODY, SECTION_HEADING, span } from './layout';
import type { FieldsProps } from './types';

export function ActFields({ idPrefix, form, patch, errors, disabled }: FieldsProps) {
  const victimError = errorFor(errors, 'victim-count');
  const roleKnown = form.role === '' || ROLES.some((option) => option.value === form.role);

  return (
    <fieldset>
      <legend className={SECTION_HEADING}>Perbuatan dan akibat</legend>
      <div className={`${SECTION_BODY} ${FORM_GRID}`}>
        <Field id={`${idPrefix}-role`} label="Peran terdakwa" className={span.role}>
          <Select id={`${idPrefix}-role`} value={form.role} onChange={(event) => patch({ role: event.target.value })} disabled={disabled}>
            <option value="">Belum diketahui</option>
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {/* A stored value that is no longer offered (e.g. "penyuruh") stays visible. */}
            {roleKnown ? null : <option value={form.role}>{humanizeSlug(form.role)}</option>}
          </Select>
        </Field>

        <Field id={`${idPrefix}-harm`} label="Akibat pada korban" asGroup className={span.full}>
          <ChipSelect
            options={VICTIM_HARM}
            value={form.victimHarm}
            onChange={(victimHarm) => patch({ victimHarm })}
            labelledBy={`${idPrefix}-harm-label`}
            disabled={disabled}
          />
        </Field>

        <Field id={`${idPrefix}-mode`} label="Cara atau alat" asGroup className={span.full}>
          <ChipSelect
            options={WEAPON_OR_MODE}
            value={form.weaponOrMode}
            onChange={(weaponOrMode) => patch({ weaponOrMode })}
            labelledBy={`${idPrefix}-mode-label`}
            disabled={disabled}
          />
        </Field>

        <Field id={`${idPrefix}-victim-count`} label="Jumlah korban" error={victimError} className={span.count}>
          <Input
            id={`${idPrefix}-victim-count`}
            inputMode="numeric"
            value={form.victimCount}
            onChange={(event) => patch({ victimCount: event.target.value })}
            aria-invalid={victimError === undefined ? undefined : true}
            aria-describedby={describedBy(`${idPrefix}-victim-count`, { error: victimError })}
            className="tabular"
            autoComplete="off"
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-loss`} label="Kerugian" className={span.money}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden>
              Rp
            </span>
            <Input
              id={`${idPrefix}-loss`}
              inputMode="numeric"
              value={formatRupiahInput(form.lossAmountIdr)}
              onChange={(event) => patch({ lossAmountIdr: rupiahDigits(event.target.value) })}
              className="tabular pl-10"
              autoComplete="off"
              disabled={disabled}
            />
          </div>
        </Field>
      </div>
    </fieldset>
  );
}
