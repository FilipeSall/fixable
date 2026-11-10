import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { RoleHome } from './RoleHome.tsx';

const LOGOUT_ERROR = 'Não foi possível sair. Verifique a conexão e tente de novo.';

export function HomeScreen() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  if (!me) return null;

  function handleLogout() {
    void leave();
  }

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
