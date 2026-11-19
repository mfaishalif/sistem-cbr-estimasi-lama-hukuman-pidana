import { Field, describedBy } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { errorFor } from '@/components/ui/error-summary';
import { Hint } from '@/components/ui/label';
import { copy } from '@/lib/copy';
import { countWords, formatInteger } from '@/lib/format';
import { span } from './layout';
import type { FieldsProps } from './types';

export function NarrationField({ idPrefix, form, patch, errors, disabled, withSample = false }: FieldsProps & { withSample?: boolean }) {
  const id = `${idPrefix}-narration`;
  const error = errorFor(errors, 'narration');
  const words = countWords(form.narration);

  return (
    <Field id={id} label={copy.estimate.narrationLabel} error={error} className={span.full}>
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
      {/* Hint under the input, like every other field; word count and sample on the same line. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Hint id={`${id}-hint`}>{copy.estimate.narrationHint}</Hint>
        <div className="flex items-baseline gap-3 text-[13px] text-ink-subtle">
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
      </div>
    </Field>
  );
}
