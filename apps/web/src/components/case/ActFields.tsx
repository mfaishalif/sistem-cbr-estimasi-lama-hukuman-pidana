import { ChipSelect } from '@/components/ui/chip';
import { Field, describedBy } from '@/components/ui/field';
import { errorFor } from '@/components/ui/error-summary';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatRupiahInput, rupiahDigits } from '@/lib/format';
import { ROLES, VICTIM_HARM, WEAPON_OR_MODE, humanizeSlug } from '@/lib/vocabulary';
import type { FieldsProps } from './types';

export function ActFields({ idPrefix, form, patch, errors, disabled }: FieldsProps) {
  const victimError = errorFor(errors, 'victim-count');
  const roleKnown = form.role === '' || ROLES.some((option) => option.value === form.role);

  return (
    <fieldset className="space-y-5">
      <legend className="text-[15px] font-semibold text-ink">Perbuatan dan akibat</legend>

      <Field id={`${idPrefix}-role`} label="Peran terdakwa" className="sm:max-w-xs">
        <Select id={`${idPrefix}-role`} value={form.role} onChange={(event) => patch({ role: event.target.value })} disabled={disabled}>
          <option value="">Belum diketahui</option>
          {ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {roleKnown ? null : <option value={form.role}>{humanizeSlug(form.role)}</option>}
        </Select>
      </Field>

      <Field id={`${idPrefix}-harm`} label="Akibat pada korban" asGroup>
        <ChipSelect
          options={VICTIM_HARM}
          value={form.victimHarm}
          onChange={(victimHarm) => patch({ victimHarm })}
          labelledBy={`${idPrefix}-harm-label`}
          disabled={disabled}
        />
      </Field>

      <Field id={`${idPrefix}-mode`} label="Cara atau alat" asGroup>
        <ChipSelect
          options={WEAPON_OR_MODE}
          value={form.weaponOrMode}
          onChange={(weaponOrMode) => patch({ weaponOrMode })}
          labelledBy={`${idPrefix}-mode-label`}
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[0.6fr_1fr]">
        <Field id={`${idPrefix}-victim-count`} label="Jumlah korban" error={victimError}>
          <Input
            id={`${idPrefix}-victim-count`}
            inputMode="numeric"
            value={form.victimCount}
            onChange={(event) => patch({ victimCount: event.target.value })}
            aria-invalid={victimError === undefined ? undefined : true}
            aria-describedby={describedBy(`${idPrefix}-victim-count`, { error: victimError })}
            className="tabular"
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-loss`} label="Kerugian">
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
              disabled={disabled}
            />
          </div>
        </Field>
      </div>
    </fieldset>
  );
}
