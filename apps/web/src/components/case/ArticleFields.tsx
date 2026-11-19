import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorFor } from '@/components/ui/error-summary';
import { Input } from '@/components/ui/input';
import { FieldMessage, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { newArticleRow, type ArticleArrangement, type ArticleRowState } from '@/lib/case-form';
import { ARRANGEMENTS } from '@/lib/vocabulary';
import type { FieldsProps } from './types';

export function ArticleFields({ idPrefix, form, patch, errors, disabled }: FieldsProps) {
  const update = (index: number, changes: Partial<ArticleRowState>) =>
    patch({ articles: form.articles.map((row, position) => (position === index ? { ...row, ...changes } : row)) });
  const remove = (index: number) => patch({ articles: form.articles.filter((_, position) => position !== index) });

  return (
    <fieldset className="space-y-3">
      <legend className="text-[15px] font-semibold text-ink">Pasal dakwaan</legend>
      {form.articles.map((row, index) => {
        const base = `${idPrefix}-article-${index}`;
        const lawError = errorFor(errors, `article-${index}-law`);
        const numberError = errorFor(errors, `article-${index}-number`);
        return (
          <div key={row.key} className="space-y-3 border-b border-rule pb-4">
            {/* Two rows so "Alternatif"/"Subsidair" always fit, even in the narrow form column. */}
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-x-3">
              <div className="space-y-1">
                <Label htmlFor={`${base}-law`} className="text-sm">UU</Label>
                <Input
                  id={`${base}-law`}
                  value={row.law}
                  onChange={(event) => update(index, { law: event.target.value })}
                  aria-invalid={lawError === undefined ? undefined : true}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${base}-number`} className="text-sm">Pasal</Label>
                <Input
                  id={`${base}-number`}
                  value={row.article}
                  onChange={(event) => update(index, { article: event.target.value })}
                  placeholder="362"
                  inputMode="text"
                  className="tabular"
                  aria-invalid={numberError === undefined ? undefined : true}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${base}-paragraph`} className="text-sm">Ayat</Label>
                <Input
                  id={`${base}-paragraph`}
                  value={row.paragraph}
                  onChange={(event) => update(index, { paragraph: event.target.value })}
                  className="tabular"
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="w-44 space-y-1">
                <Label htmlFor={`${base}-arrangement`} className="text-sm">Susunan</Label>
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
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Hapus pasal baris ${index + 1}`}
                onClick={() => remove(index)}
                disabled={disabled}
              >
                <X />
              </Button>
            </div>
            {lawError === undefined ? null : <FieldMessage>{lawError}</FieldMessage>}
            {numberError === undefined ? null : <FieldMessage>{numberError}</FieldMessage>}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 text-accent hover:text-accent-hover"
        onClick={() => patch({ articles: [...form.articles, newArticleRow()] })}
        disabled={disabled}
      >
        <Plus aria-hidden />
        Tambah pasal
      </Button>
    </fieldset>
  );
}
