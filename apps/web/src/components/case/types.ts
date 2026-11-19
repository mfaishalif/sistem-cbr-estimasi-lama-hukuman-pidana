import type { CaseFormState, FieldError } from '@/lib/case-form';

/** Shared props for the perkara fields used by Estimasi and Basis kasus. */
export interface FieldsProps {
  idPrefix: string;
  form: CaseFormState;
  patch: (changes: Partial<CaseFormState>) => void;
  errors: FieldError[];
  disabled?: boolean;
}
