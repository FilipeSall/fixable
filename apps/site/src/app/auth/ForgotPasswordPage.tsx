import { API, forgotPasswordInput } from '@fixable/shared';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { apiFetch } from '../api.ts';
import { Field } from './Field.tsx';
import { fieldErrorsOf } from '../../lib/form-errors.ts';
import { messageOf } from './form-errors.ts';

const CONFIRMATION = 'Se houver uma conta com este e-mail, enviamos um link para você criar ou redefinir sua senha.';

/** Tela de pedido de link para redefinir a senha. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  /** Evita o envio nativo do formulário e dispara a validação e o envio. */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  /** Valida o e-mail e pede o link de redefinição, mostrando erros do formulário. */
  async function submit() {
    setFormError('');
    const parsed = forgotPasswordInput.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await apiFetch<void>(API.forgot, { method: 'POST', body: { email: parsed.data.email } });
      setSent(true);
    } catch (error) {
      setFormError(messageOf(error));
      setSubmitting(false);
    }
  }

  return (
    <main className="app-home">
      <div id="login-panel">
        <h1 className="app-h">Esqueci minha senha</h1>
        {sent ? (
          <p role="status">{CONFIRMATION}</p>
        ) : (
          <form className="fx-form" noValidate onSubmit={handleSubmit}>
            <Field
              id="f-email"
              label="E-mail"
              type="email"
              autoComplete="username"
              placeholder="voce@email.com"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />
            {formError ? (
              <p className="err" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}
        <p className="auth-switch">
          <Link to="/login">Voltar para o login</Link>
        </p>
      </div>
    </main>
  );
}
