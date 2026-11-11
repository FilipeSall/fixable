import { API } from '@fixable/shared';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { apiFetch } from '../../api.ts';
import { useAuth } from './AuthProvider.tsx';
import { SetPasswordForm } from './SetPasswordForm.tsx';
import { TokenGate } from './TokenGate.tsx';
import { clearTokenFromUrl } from './token-url.ts';
import { AuthLayout } from './AuthLayout.tsx';

const RESET_NOTICE = 'Senha redefinida. Entre com a nova senha.';

/** Tela de redefinição de senha a partir do link do e-mail. */
export function ResetPasswordPage() {
  const { me, setMe } = useAuth();
  const [passwordReset, setPasswordReset] = useState(false);

  if (passwordReset && !me) {
    return <Navigate to="/login" replace state={{ notice: RESET_NOTICE }} />;
  }

  return (
    <AuthLayout>
        <h1 className="app-h">Redefinir senha</h1>
        <TokenGate purpose="redefinicao">
          {(token) => {
            /** Redefine a senha com o token, limpa o link da URL, encerra a sessão local e leva ao login com aviso. */
            async function reset(senha: string) {
              await apiFetch<void>(API.reset, { method: 'POST', body: { token, senha } });
              clearTokenFromUrl();
              await setMe(null);
              setPasswordReset(true);
            }
            return <SetPasswordForm submitLabel="Redefinir senha" busyLabel="Salvando..." onSubmit={reset} />;
          }}
        </TokenGate>
    </AuthLayout>
  );
}
