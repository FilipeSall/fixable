import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CandidaturasPage } from './features/admin/pages/CandidaturasPage.tsx';
import { EquipePage } from './features/admin/pages/EquipePage.tsx';
import { LeadsPage } from './features/admin/pages/LeadsPage.tsx';
import { CalendarioPage } from './features/agenda/pages/CalendarioPage.tsx';
import { ClientePage } from './features/clientes/pages/ClientePage.tsx';
import { ClientesPage } from './features/clientes/pages/ClientesPage.tsx';
import { MeuPainelPage } from './features/clientes/pages/MeuPainelPage.tsx';
import { AuthProvider } from './features/auth/AuthProvider.tsx';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.tsx';
import { InvitePage } from './features/auth/InvitePage.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { RequireAuth } from './features/auth/RequireAuth.tsx';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.tsx';
import { RootRedirect } from './features/auth/RootRedirect.tsx';
import { HomeScreen } from './home/HomeScreen.tsx';
import { NotFoundPage } from './NotFoundPage.tsx';
import { createQueryClient } from './query-client.ts';
import { AppShell } from './shared/components/AppShell.tsx';

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
            <Route element={<RequireAuth roles={['profissional']} />}>
              <Route path="/projetos" element={<HomeScreen />} />
            </Route>
            <Route element={<RequireAuth roles={['cliente']} />}>
              <Route element={<AppShell />}>
                <Route path="/cliente" element={<MeuPainelPage />} />
              </Route>
            </Route>
            <Route element={<RequireAuth roles={['engenheiro']} />}>
              <Route element={<AppShell />}>
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/clientes/:clientId" element={<ClientePage />} />
                <Route path="/calendario" element={<CalendarioPage />} />
              </Route>
            </Route>
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route element={<AppShell />}>
                <Route path="/admin" element={<Navigate to="/admin/leads" replace />} />
                <Route path="/admin/leads" element={<LeadsPage />} />
                <Route path="/admin/candidaturas" element={<CandidaturasPage />} />
                <Route path="/admin/equipe" element={<EquipePage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
