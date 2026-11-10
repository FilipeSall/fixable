import { loginInput } from '@fixable/shared';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { useAuth } from './AuthProvider.tsx';
import { Field } from './Field.tsx';
import { fieldErrorsOf, messageOf, serverFieldErrors } from './form-errors.ts';
import { destinationAfterLogin } from './paths.ts';

interface LocationState {
  notice?: string;
}

export function LoginPage() {
  const { me, isLoading, login } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const notice = (location.state as LocationState | null)?.notice;
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && me) {
    return <Navigate to={destinationAfterLogin(me.role, params.get('next'))} replace />;
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

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
