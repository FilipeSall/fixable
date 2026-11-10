import { API } from '@fixable/shared';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { apiFetch } from '../api.ts';
import { useAuth } from './AuthProvider.tsx';
import { SetPasswordForm } from './SetPasswordForm.tsx';
import { TokenGate } from './TokenGate.tsx';

const RESET_NOTICE = 'Senha redefinida. Entre com a nova senha.';

export function ResetPasswordPage() {
  const { me, setMe } = useAuth();
  const [passwordReset, setPasswordReset] = useState(false);

  if (passwordReset && !me) {
    return <Navigate to="/login" replace state={{ notice: RESET_NOTICE }} />;
  }

  return (
    <main className="app-home">
      <div id="login-panel">
        <h1 className="app-h">Redefinir senha</h1>
        <TokenGate purpose="redefinicao">
          {(token) => {
            async function reset(senha: string) {
              await apiFetch<void>(API.reset, { method: 'POST', body: { token, senha } });
              setMe(null);
              setPasswordReset(true);
            }
            return <SetPasswordForm submitLabel="Redefinir senha" busyLabel="Salvando..." onSubmit={reset} />;
          }}
        </TokenGate>
      </div>
    </main>
  );
}
