import { useEffect, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { Disclosure } from '@/components/ui/disclosure';
import { detailSummary } from '@/lib/case-form';
import { copy } from '@/lib/copy';
import { formatInteger } from '@/lib/format';
import { ActFields } from './ActFields';
import { ArticleFields } from './ArticleFields';
import { DefendantFields } from './DefendantFields';
import type { FieldsProps } from './types';

const DETAIL_FIELDS = /^(article-|age|victim-count)/;

/** "Tambah detail perkara (opsional)": closed by default, opens itself on a detail error. */
export function CaseDetailsFields(props: FieldsProps & { defaultOpen?: boolean }) {
  const { form, errors, defaultOpen = false } = props;
  const [open, setOpen] = useState(defaultOpen);
  const chips = detailSummary(form);

  useEffect(() => {
    if (errors.some((error) => DETAIL_FIELDS.test(error.field))) setOpen(true);
  }, [errors]);

  return (
    <Disclosure
      open={open}
      onOpenChange={setOpen}
      title={copy.estimate.detailsToggle}
      meta={chips.length === 0 ? `(${copy.estimate.detailsOptional})` : `${formatInteger(chips.length)} terisi`}
      summary={
        chips.length === 0 ? undefined : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Detail yang terisi">
            {chips.map((chip, index) => (
              <li key={`${chip}-${index}`}>
                <Chip>{chip}</Chip>
              </li>
            ))}
          </ul>
        )
      }
    >
      <div className="space-y-8 pl-0 sm:pl-6">
        <ArticleFields {...props} />
        <DefendantFields {...props} />
        <ActFields {...props} />
      </div>
    </Disclosure>
  );
}
