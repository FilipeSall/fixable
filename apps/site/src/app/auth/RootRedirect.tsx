import { Navigate } from 'react-router';
import { useAuth } from './AuthProvider.tsx';
import { homeFor } from './paths.ts';

/** Redireciona a raiz do app para a página do papel ou para o login. */
export function RootRedirect() {
  const { me, isLoading } = useAuth();
  if (isLoading) return <p role="status">Carregando...</p>;
  return <Navigate to={me ? homeFor(me.role) : '/login'} replace />;
}
