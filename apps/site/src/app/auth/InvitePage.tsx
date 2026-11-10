import { API } from '@fixable/shared';
import type { Me } from '@fixable/shared';
import { useNavigate } from 'react-router';
import { apiFetch } from '../api.ts';
import { useAuth } from './AuthProvider.tsx';
import { homeFor } from './paths.ts';
import { SetPasswordForm } from './SetPasswordForm.tsx';
import { TokenGate } from './TokenGate.tsx';

export function InvitePage() {
  const { setMe } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="app-home">
      <div id="login-panel">
        <h1 className="app-h">Crie sua senha</h1>
        <TokenGate purpose="convite">
          {(token, info) => {
            async function accept(senha: string) {
              const me = await apiFetch<Me>(API.acceptInvite, { method: 'POST', body: { token, senha } });
              await setMe(me);
              await navigate(homeFor(me.role), { replace: true });
            }
            return (
              <>
                <p className="muted">Olá, {info.nome}. Defina uma senha para acessar a Fixable.</p>
                <SetPasswordForm submitLabel="Criar senha" busyLabel="Salvando..." onSubmit={accept} />
              </>
            );
          }}
        </TokenGate>
      </div>
    </main>
  );
}
