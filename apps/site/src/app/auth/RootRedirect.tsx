import { Navigate } from 'react-router';
import { useAuth } from './AuthProvider.tsx';
import { homeFor } from './paths.ts';
import { SessionError } from './SessionError.tsx';

/** Redireciona a raiz do app para a página do papel ou para o login. */
export function RootRedirect() {
  const { me, status } = useAuth();
  if (status === 'loading') return <p role="status">Carregando...</p>;
  if (status === 'error') return <SessionError />;
  return <Navigate to={me ? homeFor(me.role) : '/login'} replace />;
}
