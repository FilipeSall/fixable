import type { Me } from '@fixable/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';
import { ApiRequestError, apiFetch } from '../api.ts';
import { AuthProvider } from './AuthProvider.tsx';

export const ana: Me = {
  id: '00000000-0000-4000-8000-000000000001',
  nome: 'Ana Souza',
  email: 'ana@fixable.com',
  role: 'cliente',
};

export const mockedFetch = vi.mocked(apiFetch);

/** Cria o erro 401 usado nos testes para simular a ausência de sessão. */
export function unauthenticated() {
  return new ApiRequestError(401, 'unauthorized', 'Faça login para continuar.');
}

/** Exibe o caminho atual do roteador para os testes verificarem a navegação. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Renderiza a interface com React Query, roteador em memória e autenticação para os testes. */
export function renderApp(ui: ReactNode, route = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          {ui}
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
