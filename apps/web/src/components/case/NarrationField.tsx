import { Field, describedBy } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { errorFor } from '@/components/ui/error-summary';
import { copy } from '@/lib/copy';
import { countWords, formatInteger } from '@/lib/format';
import type { FieldsProps } from './types';

export function NarrationField({ idPrefix, form, patch, errors, disabled, withSample = false }: FieldsProps & { withSample?: boolean }) {
  const id = `${idPrefix}-narration`;
  const error = errorFor(errors, 'narration');
  const words = countWords(form.narration);

  return (
    <Field id={id} label={copy.estimate.narrationLabel} hint={copy.estimate.narrationHint} error={error}>
      <Textarea
        id={id}
        rows={8}
        value={form.narration}
        onChange={(event) => patch({ narration: event.target.value })}
        placeholder={copy.estimate.narrationPlaceholder}
        aria-describedby={[describedBy(id, { hint: true, error }), `${id}-count`].filter(Boolean).join(' ')}
        aria-invalid={error === undefined ? undefined : true}
        aria-required
        disabled={disabled}
        className="min-h-56 text-[16px]"
      />
      <div className="flex items-center justify-between gap-4 text-[13px] text-ink-subtle">
        <span id={`${id}-count`} className="tabular" aria-live="off">
          {formatInteger(words)} kata
        </span>
        {withSample ? (
          <button
            type="button"
            className="min-h-11 text-accent underline underline-offset-4 hover:text-accent-hover sm:min-h-0"
            onClick={() => patch({ narration: copy.estimate.sample, category: form.category || 'pencurian' })}
            disabled={disabled}
          >
            {copy.estimate.fillSample}
          </button>
        ) : null}
      </div>
    </Field>
  );
}
