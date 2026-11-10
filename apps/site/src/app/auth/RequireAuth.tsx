import { Navigate, Outlet, useLocation } from 'react-router';
import type { RequireAuthProps } from '../../types/auth-screens.types.ts';
import { useAuth } from './AuthProvider.tsx';
import { homeFor } from './paths.ts';
import { SessionError } from './SessionError.tsx';

/** Rota protegida: exige login e, quando informado, um dos papéis permitidos; falha da verificação não desloga. */
export function RequireAuth({ roles }: Readonly<RequireAuthProps>) {
  const { me, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <p role="status">Carregando...</p>;
  if (status === 'error') return <SessionError />;
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <Outlet />;
}
