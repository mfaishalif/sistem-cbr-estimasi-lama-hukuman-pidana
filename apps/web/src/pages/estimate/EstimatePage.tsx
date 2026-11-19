import { useCallback, useMemo, useRef, useState } from 'react';
import { EstimateForm } from '@/components/estimate/EstimateForm';
import { ResultPanel } from '@/components/estimate/ResultPanel';
import { sameFacts, useEstimate } from '@/hooks/useEstimate';
import { useIndexStatus } from '@/hooks/useIndexStatus';
import { buildFacts, emptyCaseForm, validateNarration, type CaseFormState, type FieldError } from '@/lib/case-form';
import { copy } from '@/lib/copy';

const ID_PREFIX = 'estimate';

export function EstimatePage() {
  const [form, setForm] = useState<CaseFormState>(emptyCaseForm);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const { index, refresh } = useIndexStatus();
  const onSettled = useCallback(() => void refresh(), [refresh]);
  const { state, run } = useEstimate(onSettled);
  const resultRef = useRef<HTMLElement>(null);

  const patch = useCallback((changes: Partial<CaseFormState>) => setForm((current) => ({ ...current, ...changes })), []);

  const submit = (override?: Partial<CaseFormState>) => {
    const next = override === undefined ? form : { ...form, ...override };
    const found: FieldError[] = [];
    validateNarration(next, found);
    const facts = buildFacts(next, found);
    setErrors(found);
    if (found.length > 0) return;
    if (override !== undefined) setForm(next);
    void run(facts);
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const stale = useMemo(() => {
    if (state.phase !== 'done') return false;
    return !sameFacts(buildFacts(form, []), state.facts);
  }, [form, state]);

  const focusNarration = () => {
    const element = document.getElementById(`${ID_PREFIX}-narration`);
    element?.focus();
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <div className="space-y-10 lg:space-y-14">
      <header className="mx-auto max-w-3xl space-y-3 text-center">
        <h1 className="text-balance font-serif text-[32px] font-semibold leading-tight text-ink sm:text-[40px]">{copy.estimate.title}</h1>
        <p className="text-balance text-[17px] text-ink-muted">{copy.estimate.intro}</p>
      </header>

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        <section className="lg:col-span-5" aria-label="Data perkara">
          <EstimateForm
            idPrefix={ID_PREFIX}
            form={form}
            patch={patch}
            errors={errors}
            onSubmit={() => submit()}
            loading={state.phase === 'loading'}
            index={index}
          />
        </section>
        <section ref={resultRef} className="scroll-mt-6 lg:col-span-7" aria-label="Hasil estimasi" aria-busy={state.phase === 'loading'}>
          <ResultPanel
            state={state}
            stale={stale}
            index={index}
            onRetry={() => submit()}
            onSearchAllCategories={() => submit({ category: '' })}
            onEditNarration={focusNarration}
          />
        </section>
      </div>
    </div>
  );
}
