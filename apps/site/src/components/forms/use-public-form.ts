import { useState } from 'react';
import { fieldErrorsOf } from '../../app/auth/form-errors.ts';
import type { FormValues, PublicFormConfig, PublicFormState } from '../../types/public-forms.types.ts';
import { submitPublicForm } from './public-submit.ts';

/** Controla valores, validação com Zod, envio à API e estado de sucesso de um formulário público. */
export function usePublicForm(config: PublicFormConfig): PublicFormState {
  const [values, setValues] = useState<FormValues>(config.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

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

  return { values, errors, formError, sending, done, setValue, submit, reset };
}
