import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorFor } from '@/components/ui/error-summary';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FieldMessage } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { newArticleRow, type ArticleArrangement, type ArticleRowState } from '@/lib/case-form';
import { cn } from '@/lib/utils';
import { ARRANGEMENTS } from '@/lib/vocabulary';
import { SECTION_BODY, SECTION_HEADING, span } from './layout';
import type { FieldsProps } from './types';

/**
 * One article per grid row: UU | Pasal | Ayat | Susunan | hapus. In a narrow
 * form the same grid wraps into two lines (UU+Pasal+Ayat, Susunan+hapus).
 * Column labels show on the first row only; later rows keep them for screen
 * readers so every input stays labelled.
 */
export function ArticleFields({ idPrefix, form, patch, errors, disabled }: FieldsProps) {
  const update = (index: number, changes: Partial<ArticleRowState>) =>
    patch({ articles: form.articles.map((row, position) => (position === index ? { ...row, ...changes } : row)) });
  const remove = (index: number) => patch({ articles: form.articles.filter((_, position) => position !== index) });

  return (
    <fieldset>
      <legend className={SECTION_HEADING}>Pasal dakwaan</legend>
      <div className={SECTION_BODY}>
        {form.articles.length === 0 ? null : (
          <div className="flex flex-col gap-y-5 @2xl:gap-y-3">
            {form.articles.map((row, index) => {
              const base = `${idPrefix}-article-${index}`;
              const lawError = errorFor(errors, `article-${index}-law`);
              const numberError = errorFor(errors, `article-${index}-number`);
              const hideLabel = index > 0;
              return (
                <div key={row.key} className="grid grid-cols-12 gap-x-4 gap-y-3">
                  <Field id={`${base}-law`} label="UU" hideLabel={hideLabel} className={span.law}>
                    <Input
                      id={`${base}-law`}
                      value={row.law}
                      onChange={(event) => update(index, { law: event.target.value })}
                      aria-invalid={lawError === undefined ? undefined : true}
                      autoComplete="off"
                      disabled={disabled}
                    />
                  </Field>
                  <Field id={`${base}-number`} label="Pasal" hideLabel={hideLabel} className={span.articleNumber}>
                    <Input
                      id={`${base}-number`}
                      value={row.article}
                      onChange={(event) => update(index, { article: event.target.value })}
                      placeholder="mis. 363"
                      // Text keyboard on purpose: article numbers can carry letters (27A, 363 bis).
                      inputMode="text"
                      className="tabular"
                      aria-invalid={numberError === undefined ? undefined : true}
                      autoComplete="off"
                      disabled={disabled}
                    />
                  </Field>
                  <Field id={`${base}-paragraph`} label="Ayat" hideLabel={hideLabel} className={span.paragraph}>
                    <Input
                      id={`${base}-paragraph`}
                      value={row.paragraph}
                      onChange={(event) => update(index, { paragraph: event.target.value })}
                      placeholder="mis. 1"
                      inputMode="numeric"
                      className="tabular"
                      autoComplete="off"
                      disabled={disabled}
                    />
                  </Field>
                  <Field id={`${base}-arrangement`} label="Susunan" hideLabel={hideLabel} className={span.arrangement}>
                    <Select
                      id={`${base}-arrangement`}
                      value={row.arrangement}
                      onChange={(event) => update(index, { arrangement: event.target.value as ArticleArrangement })}
                      disabled={disabled}
                    >
                      {ARRANGEMENTS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {/* The slot always exists so the columns never shift. */}
                  <div className={cn(span.remove, 'flex items-end justify-end')}>
                    <Button
                      variant="ghost"
                      className="mb-0.5 size-10 p-0"
                      aria-label={`Hapus pasal ke-${index + 1}`}
                      onClick={() => remove(index)}
                      disabled={disabled}
                    >
                      <X />
                    </Button>
                  </div>
                  {lawError === undefined && numberError === undefined ? null : (
                    <div className="col-span-12 space-y-1">
                      {lawError === undefined ? null : <FieldMessage>{lawError}</FieldMessage>}
                      {numberError === undefined ? null : <FieldMessage>{numberError}</FieldMessage>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn('-ml-3 text-accent hover:text-accent-hover', form.articles.length > 0 && 'mt-3')}
          onClick={() => patch({ articles: [...form.articles, newArticleRow()] })}
          disabled={disabled}
        >
          <Plus aria-hidden />
          Tambah pasal
        </Button>
      </div>
    </fieldset>
  );
}
