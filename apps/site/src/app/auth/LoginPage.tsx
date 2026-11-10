import { loginInput } from '@fixable/shared';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import type { LocationState } from '../../types/auth-screens.types.ts';
import { useAuth } from './AuthProvider.tsx';
import { Field } from './Field.tsx';
import { fieldErrorsOf } from '../../lib/form-errors.ts';
import { messageOf, serverFieldErrors } from './form-errors.ts';
import { destinationAfterLogin } from './paths.ts';

/** Tela de login com validação do formulário e redirecionamento de quem já está autenticado. */
export function LoginPage() {
  const { me, login } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const notice = (location.state as LocationState | null)?.notice;
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (me) {
    return <Navigate to={destinationAfterLogin(me.role, params.get('next'))} replace />;
  }

  /** Evita o envio nativo do formulário e dispara a validação e o login. */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  /** Valida os campos e faz o login, mostrando erros do formulário e do servidor. */
  async function submit() {
    setFormError('');
    const parsed = loginInput.safeParse({ email, senha });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.senha);
    } catch (error) {
      setErrors(serverFieldErrors(error));
      setFormError(messageOf(error));
      setSubmitting(false);
    }
  }

  return (
    <main className="app-home">
      <div id="login-panel">
        <h1 className="app-h">Entrar na plataforma</h1>
        {notice ? <p role="status">{notice}</p> : null}
        <form className="fx-form" noValidate onSubmit={handleSubmit}>
          <Field
            id="l-email"
            label="E-mail"
            type="email"
            autoComplete="username"
            placeholder="voce@email.com"
            value={email}
            onChange={setEmail}
            error={errors.email}
          />
          <Field
            id="l-senha"
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={senha}
            onChange={setSenha}
            error={errors.senha}
          />
          {formError ? (
            <p className="err" role="alert">
              {formError}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/esqueci-senha">Esqueci minha senha</Link>
        </p>
      </div>
    </main>
  );
}
