import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { copy } from '@/lib/copy';
import { CATEGORIES, categoryLabel } from '@/lib/vocabulary';
import type { FieldsProps } from './types';

export function CategoryField({ idPrefix, form, patch, disabled, unknownLabel = copy.estimate.categoryUnknown }: FieldsProps & { unknownLabel?: string }) {
  const id = `${idPrefix}-category`;
  const known = form.category === '' || CATEGORIES.some((option) => option.value === form.category);
  return (
    <Field id={id} label={copy.estimate.categoryLabel}>
      <Select id={id} value={form.category} onChange={(event) => patch({ category: event.target.value })} disabled={disabled}>
        <option value="">{unknownLabel}</option>
        {CATEGORIES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {known ? null : <option value={form.category}>{categoryLabel(form.category)}</option>}
      </Select>
    </Field>
  );
}
