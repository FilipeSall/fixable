import type { Role } from '@fixable/shared';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import type { SideNavSection } from '../../../types/platform-ui.types.ts';
import { useAuth } from '../../features/auth/AuthProvider.tsx';
import { Avatar } from './Avatar.tsx';
import { SideNav } from './SideNav.tsx';
import { ToastProvider } from './Toast.tsx';

const ROLE_LABELS: Record<Role, string> = {
  cliente: 'Painel do cliente',
  engenheiro: 'Painel do engenheiro',
  admin: 'Painel do administrador',
  profissional: 'Painel do profissional parceiro',
};

const USER_SUBTITLES: Record<Role, string> = {
  cliente: 'Cliente Fixable',
  engenheiro: 'Engenheiro responsável',
  admin: 'Administrador',
  profissional: 'Profissional parceiro',
};

const SECTIONS: Partial<Record<Role, SideNavSection>> = {
  engenheiro: {
    label: 'Gestão',
    items: [
      { to: '/clientes', label: 'Clientes' },
      { to: '/calendario', label: 'Calendário' },
    ],
  },
  admin: {
    label: 'Administração',
    items: [
      { to: '/admin/leads', label: 'Leads' },
      { to: '/admin/candidaturas', label: 'Candidaturas' },
      { to: '/admin/equipe', label: 'Equipe' },
    ],
  },
};

const LOGOUT_ERROR = 'Não foi possível sair. Verifique a conexão e tente de novo.';

/** Casca da plataforma logada: topo com perfil e Sair, barra lateral por papel e a página atual. */
export function AppShell() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  if (!me) return null;
  const section = SECTIONS[me.role];

  /** Dispara a saída sem esperar a promessa dentro do evento de clique. */
  function handleLogout() {
    void leave();
  }

  /** Encerra a sessão e volta ao login, ou mostra o erro quando a saída falha. */
  async function leave() {
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError(LOGOUT_ERROR);
      return;
    }
    await navigate('/login', { replace: true });
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="app-top">
          <div className="app-top-inner">
            <a className="app-brand" href="/" aria-label="Voltar ao site">
              <span>fixable</span>
            </a>
            <span className="app-role">{ROLE_LABELS[me.role]}</span>
            <div className="app-top-right">
              <div className="app-user">
                <span className="txt">
                  <strong>{me.nome}</strong>
                  <small>{USER_SUBTITLES[me.role]}</small>
                </span>
                <Avatar nome={me.nome} size="sm" />
              </div>
              <button type="button" className="app-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>
          {logoutError ? (
            <p className="err" role="alert" style={{ padding: '0 28px 10px' }}>
              {logoutError}
            </p>
          ) : null}
        </header>
        <div className={section ? 'app-body' : 'app-body no-side'}>
          {section ? <SideNav section={section} /> : null}
          <main className="app-main">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
