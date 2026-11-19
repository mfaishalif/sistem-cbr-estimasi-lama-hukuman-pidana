import { Field, describedBy } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/toggle-group';
import { DURATION_UNITS, type DurationUnit } from '@/lib/duration';

interface SentenceInputProps {
  id: string;
  label: string;
  amount: string;
  unit: DurationUnit;
  onAmountChange: (amount: string) => void;
  onUnitChange: (unit: DurationUnit) => void;
  preview: string | null;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

/** Amount + Tahun/Bulan/Hari with a live "= n hari" preview. */
export function SentenceInput({ id, label, amount, unit, onAmountChange, onUnitChange, preview, error, hint, disabled }: SentenceInputProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          id={id}
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={[describedBy(id, { error, hint: hint !== undefined }), `${id}-preview`].filter(Boolean).join(' ')}
          className="tabular w-32"
          disabled={disabled}
        />
        <Segmented value={unit} onChange={onUnitChange} options={DURATION_UNITS} ariaLabel={`Satuan ${label.toLowerCase()}`} disabled={disabled} />
        <span id={`${id}-preview`} className="tabular text-[15px] text-ink-muted">
          {preview ?? ''}
        </span>
      </div>
    </Field>
  );
}
