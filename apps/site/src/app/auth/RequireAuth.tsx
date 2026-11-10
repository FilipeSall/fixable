import type { Role } from '@fixable/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider.tsx';
import { homeFor } from './paths.ts';

export function RequireAuth({ roles }: Readonly<{ roles?: Role[] }>) {
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
