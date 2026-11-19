import { useEffect, useRef } from 'react';
import type { FieldError } from '@/lib/case-form';

interface ErrorSummaryProps {
  title: string;
  errors: FieldError[];
  idPrefix: string;
}

/**
 * GOV.UK-style error summary: receives focus when it appears and links each
 * message to its field.
 */
export function ErrorSummary({ title, errors, idPrefix }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${idPrefix}-error-summary-title`}
      className="rounded-md border-2 border-danger bg-surface p-4"
    >
      <h2 id={`${idPrefix}-error-summary-title`} className="text-[15px] font-semibold text-ink">
        {title}
      </h2>
      <ul className="mt-2 space-y-1">
        {errors.map((error) => (
          <li key={`${error.field}-${error.message}`}>
            <a
              href={`#${idPrefix}-${error.field}`}
              onClick={(event) => {
                const target = document.getElementById(`${idPrefix}-${error.field}`);
                if (target !== null) {
                  event.preventDefault();
                  target.focus();
                  target.scrollIntoView({ block: 'center' });
                }
              }}
              className="text-[15px] font-medium text-danger underline underline-offset-4"
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function errorFor(errors: FieldError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}
