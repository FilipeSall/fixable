import { API } from '@fixable/shared';
import { useNavigate } from 'react-router';
import { apiFetch } from '../api.ts';
import { SetPasswordForm } from './SetPasswordForm.tsx';
import { TokenGate } from './TokenGate.tsx';

const RESET_NOTICE = 'Senha redefinida. Entre com a nova senha.';

export function ResetPasswordPage() {
  const navigate = useNavigate();

  return (
    <main className="app-home">
      <div id="login-panel">
        <h1 className="app-h">Redefinir senha</h1>
        <TokenGate purpose="redefinicao">
          {(token) => {
            async function reset(senha: string) {
              await apiFetch<void>(API.reset, { method: 'POST', body: { token, senha } });
              await navigate('/login', { replace: true, state: { notice: RESET_NOTICE } });
            }
            return <SetPasswordForm submitLabel="Redefinir senha" busyLabel="Salvando..." onSubmit={reset} />;
          }}
        </TokenGate>
      </div>
    </main>
  );
}
