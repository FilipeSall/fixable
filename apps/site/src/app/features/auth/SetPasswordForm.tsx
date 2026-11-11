import { passwordSchema } from '@fixable/shared';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Field } from './Field.tsx';
import type { SetPasswordFormProps } from '../../../types/auth-screens.types.ts';
import { messageOf, serverFieldErrors } from './form-errors.ts';

const MISMATCH_MESSAGE = 'As senhas não conferem.';

/** Formulário de nova senha com confirmação, usado no convite e na redefinição. */
export function SetPasswordForm({ submitLabel, busyLabel, onSubmit }: Readonly<SetPasswordFormProps>) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** Evita o envio nativo do formulário e dispara a validação e o envio. */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  /** Valida a senha e a confirmação e chama o envio, mostrando os erros do formulário e do servidor. */
  async function submit() {
    setFormError('');
    const parsed = passwordSchema.safeParse(senha);
    if (!parsed.success) {
      setErrors({ senha: parsed.error.issues[0]?.message ?? '' });
      return;
    }
    if (senha !== confirmacao) {
      setErrors({ confirmacao: MISMATCH_MESSAGE });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(senha);
    } catch (error) {
      setErrors(serverFieldErrors(error));
      setFormError(messageOf(error));
      setSubmitting(false);
    }
  }

  return (
    <form className="fx-form" noValidate onSubmit={handleSubmit}>
      <Field
        id="p-senha"
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres, com letras e números"
        value={senha}
        onChange={setSenha}
        error={errors.senha}
      />
      <Field
        id="p-confirmacao"
        label="Confirmar senha"
        type="password"
        autoComplete="new-password"
        value={confirmacao}
        onChange={setConfirmacao}
        error={errors.confirmacao}
      />
      {formError ? (
        <p className="err" role="alert">
          {formError}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? busyLabel : submitLabel}
      </button>
    </form>
  );
}
