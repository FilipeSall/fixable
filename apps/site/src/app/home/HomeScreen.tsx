import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider.tsx';
import { RoleHome } from './RoleHome.tsx';

const LOGOUT_ERROR = 'Não foi possível sair. Verifique a conexão e tente de novo.';

/** Tela inicial do usuário logado, com a ação de sair. */
export function HomeScreen() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  if (!me) return null;

  /** Evita esperar a promessa de saída dentro do evento de clique. */
  function handleLogout() {
    void leave();
  }

  /** Encerra a sessão e leva ao login, ou mostra o erro se a saída falhar. */
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

  return <RoleHome me={me} logoutError={logoutError} onLogout={handleLogout} />;
}
