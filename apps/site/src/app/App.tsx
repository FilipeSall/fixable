import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ApiRequestError } from './api.ts';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage.tsx';
import { InvitePage } from './auth/InvitePage.tsx';
import { LoginPage } from './auth/LoginPage.tsx';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { ResetPasswordPage } from './auth/ResetPasswordPage.tsx';
import { RootRedirect } from './auth/RootRedirect.tsx';
import { HomeScreen } from './home/HomeScreen.tsx';

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const MAX_RETRIES = 2;

/** Decide se o React Query deve tentar de novo: nunca em erro 4xx e até o limite nos demais casos. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiRequestError &&
    error.status >= HTTP_CLIENT_ERROR_MIN &&
    error.status < HTTP_SERVER_ERROR_MIN
  ) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/** Cria o cliente do React Query com a política de repetição do app. */
function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}

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
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
