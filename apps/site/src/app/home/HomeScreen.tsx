import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { RoleHome } from './RoleHome.tsx';

export function HomeScreen() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  if (!me) return null;

  function handleLogout() {
    void leave();
  }

  async function leave() {
    await logout();
    await navigate('/login', { replace: true });
  }

  return <RoleHome me={me} onLogout={handleLogout} />;
}
