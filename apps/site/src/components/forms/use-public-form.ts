import { useLayoutEffect, useState, type RefObject } from 'react';
import { fieldErrorsOf } from '../../lib/form-errors.ts';
import { useHydrated } from '../../lib/hydration.ts';
import type { FormValues, PublicFormConfig, PublicFormState } from '../../types/public-forms.types.ts';
import { submitPublicForm } from './public-submit.ts';

/** Lê no formulário do servidor o que o visitante digitou antes da hidratação e devolve só o que difere do valor inicial. */
function typedBeforeHydration(form: HTMLFormElement | null, initial: FormValues): FormValues {
  const typed: FormValues = {};
  if (!form) return typed;
  for (const [name, initialValue] of Object.entries(initial)) {
    const element = form.elements.namedItem(name);
    if (element instanceof HTMLInputElement && typeof initialValue === 'boolean') {
      if (element.checked !== initialValue) typed[name] = element.checked;
    } else if (
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) &&
      element.value !== initialValue
    ) {
      typed[name] = element.value;
    }
  }
  return typed;
}

/** Controla valores, validação com Zod, envio à API e estado de sucesso de um formulário público ligado ao formRef. */
export function usePublicForm(config: PublicFormConfig, formRef: RefObject<HTMLFormElement | null>): PublicFormState {
  const [values, setValues] = useState<FormValues>(config.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [initial] = useState(config.initial);
  const hydrated = useHydrated();

  useLayoutEffect(() => {
    const typed = typedBeforeHydration(formRef.current, initial);
    if (Object.keys(typed).length > 0) setValues((current) => ({ ...current, ...typed }));
  }, [formRef, initial]);

  /** Atualiza um campo e limpa o erro dele. */
  function setValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  /** Mostra os erros e leva o foco ao primeiro campo inválido, na ordem do formulário. */
  function fail(fields: Record<string, string>) {
    setErrors(fields);
    const first = config.order.find((name) => fields[name]);
    document.getElementById(`${config.idPrefix}-${first}`)?.focus();
  }

  /** Valida os dados, envia à API e atualiza o estado conforme a resposta. */
  async function run() {
    setFormError('');
    const parsed = config.schema.safeParse({ ...values, ...config.extraBody?.() });
    if (!parsed.success) {
      fail(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setSending(true);
    const result = await submitPublicForm(config.url, parsed.data);
    setSending(false);
    if (result.ok) {
      setDone(true);
      config.onSuccess?.();
      return;
    }
    setFormError(result.message);
    if (result.fields) fail(result.fields);
  }

  /** Impede o envio nativo e dispara a validação e o envio. */
  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    void run();
  }

  /** Volta o formulário ao estado inicial. */
  function reset() {
    setValues(config.initial);
    setErrors({});
    setFormError('');
    setDone(false);
  }

  return { hydrated, values, errors, formError, sending, done, setValue, submit, reset };
}
