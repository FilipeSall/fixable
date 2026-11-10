import { Navigate, Outlet, useLocation } from 'react-router';
import type { RequireAuthProps } from '../../types/auth-screens.types.ts';
import { useAuth } from './AuthProvider.tsx';
import { homeFor } from './paths.ts';

/** Rota protegida: exige login e, quando informado, um dos papéis permitidos. */
export function RequireAuth({ roles }: Readonly<RequireAuthProps>) {
  const { me, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <p role="status">Carregando...</p>;
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <Outlet />;
}
