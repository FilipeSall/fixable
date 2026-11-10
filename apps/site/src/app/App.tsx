import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage.tsx';
import { InvitePage } from './auth/InvitePage.tsx';
import { LoginPage } from './auth/LoginPage.tsx';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { ResetPasswordPage } from './auth/ResetPasswordPage.tsx';
import { RootRedirect } from './auth/RootRedirect.tsx';
import { HomeScreen } from './home/HomeScreen.tsx';
import { NotFoundPage } from './NotFoundPage.tsx';
import { createQueryClient } from './query-client.ts';

const HOME_ROUTES = [
  { path: '/cliente', role: 'cliente' },
  { path: '/clientes', role: 'engenheiro' },
  { path: '/projetos', role: 'profissional' },
  { path: '/admin', role: 'admin' },
] as const;

/** Raiz do app: provê o React Query, o roteador e a autenticação e declara as rotas. */
export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/convite" element={<InvitePage />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            {HOME_ROUTES.map(({ path, role }) => (
              <Route key={path} element={<RequireAuth roles={[role]} />}>
                <Route path={path} element={<HomeScreen />} />
              </Route>
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
