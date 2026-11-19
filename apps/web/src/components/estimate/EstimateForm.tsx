import type { FormEvent, KeyboardEvent } from 'react';
import { CaseDetailsFields } from '@/components/case/CaseDetailsFields';
import { CategoryField } from '@/components/case/CategoryField';
import { FORM_CONTAINER, FORM_GRID, SECTION_GAP } from '@/components/case/layout';
import { NarrationField } from '@/components/case/NarrationField';
import type { FieldsProps } from '@/components/case/types';
import { Button } from '@/components/ui/button';
import { ErrorSummary } from '@/components/ui/error-summary';
import type { IndexStatus } from '@/lib/api';
import { copy } from '@/lib/copy';

interface EstimateFormProps extends FieldsProps {
  onSubmit: () => void;
  loading: boolean;
  index: IndexStatus | null;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function EstimateForm({ onSubmit, loading, index, ...fields }: EstimateFormProps) {
  const building = index?.status === 'building';
  const blocked = loading || building;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!blocked) onSubmit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!blocked) onSubmit();
    }
  };

  const note = building ? copy.estimate.buildingReason : index?.status === 'stale' ? copy.estimate.staleNote : null;

  return (
    <form noValidate autoComplete="off" onSubmit={submit} onKeyDown={onKeyDown} className={`${FORM_CONTAINER} ${SECTION_GAP}`}>
      <ErrorSummary title={copy.estimate.errorSummaryTitle} errors={fields.errors} idPrefix={fields.idPrefix} />
      <div className={FORM_GRID}>
        <NarrationField {...fields} withSample />
        <CategoryField {...fields} />
      </div>
      <CaseDetailsFields {...fields} />

      <div className="space-y-3 border-t border-rule pt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" variant="primary" disabled={blocked} aria-describedby={note === null ? undefined : 'estimate-submit-note'}>
            {loading ? copy.estimate.submitting : copy.estimate.submit}
          </Button>
          <kbd className="hidden font-sans text-[13px] text-ink-subtle sm:inline">
            {isMac ? '⌘ + Enter' : copy.estimate.shortcut}
          </kbd>
        </div>
        {note === null ? null : (
          <p id="estimate-submit-note" className="text-sm text-ink-subtle">
            {note}
          </p>
        )}
      </div>
    </form>
  );
}
