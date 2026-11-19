import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useVocabulary } from '@/hooks/useVocabulary';
import { copy } from '@/lib/copy';
import { formatInteger } from '@/lib/format';
import { categoryLabel, humanizeSlug } from '@/lib/vocabulary';
import { span } from './layout';
import type { FieldsProps } from './types';

function optionLabel(label: string, count: number): string {
  return count > 0 ? `${label} (${formatInteger(count)})` : label;
}

export function CategoryField({
  idPrefix,
  form,
  patch,
  disabled,
  unknownLabel = copy.estimate.categoryUnknown,
  allowCustom = false,
}: FieldsProps & { unknownLabel?: string; allowCustom?: boolean }) {
  const id = `${idPrefix}-category`;
  const { categories } = useVocabulary();
  const known = form.category === '' || categories.some((option) => option.value === form.category);

  return (
    <Field
      id={id}
      label={copy.estimate.categoryLabel}
      className={span.select}
      hint={allowCustom ? 'Pilih kategori yang ada atau tulis kategori baru.' : undefined}
    >
      {allowCustom ? (
        <>
          <Input
            id={id}
            list={`${id}-options`}
            value={form.category}
            onChange={(event) => patch({ category: event.target.value })}
            placeholder="mis. pencurian"
            autoComplete="off"
            disabled={disabled}
          />
          <datalist id={`${id}-options`}>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {optionLabel(option.label, option.caseCount)}
              </option>
            ))}
          </datalist>
        </>
      ) : (
        <Select id={id} value={form.category} onChange={(event) => patch({ category: event.target.value })} disabled={disabled}>
          <option value="">{unknownLabel}</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {optionLabel(option.label, option.caseCount)}
            </option>
          ))}
          {known ? null : <option value={form.category}>{categoryLabel(form.category) ?? humanizeSlug(form.category)}</option>}
        </Select>
      )}
    </Field>
  );
}
