import { API, type ClientDetail, type Me } from '@fixable/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { MeuPainelPage } from '../clientes/pages/MeuPainelPage.tsx';
import { AuthProvider, useAuth } from './AuthProvider.tsx';
import { LoginPage } from './LoginPage.tsx';
import { ME_KEY } from './me-key.ts';
import { RequireAuth } from './RequireAuth.tsx';
import { ana, mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const bruno: Me = { id: '00000000-0000-4000-8000-000000000002', nome: 'Bruno Costa', email: 'bruno@fixable.com', role: 'cliente' };

const detailOf = (id: string, nome: string, email: string): ClientDetail => ({
  id,
  nome,
  email,
  telefone: null,
  engenheiro: null,
  properties: [],
});

type Init = { method?: string; body?: unknown } | undefined;

function stubSessions(pending: Set<string>) {
  const users: Record<string, Me> = { [ana.email]: ana, [bruno.email]: bruno };
  let current: Me | null = null;
  mockedFetch.mockImplementation((path: string, init?: Init) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    if (key === `POST ${API.login}`) {
      current = users[(init?.body as { email: string }).email] ?? null;
      return Promise.resolve(current);
    }
    if (key === `POST ${API.logout}`) {
      current = null;
      return Promise.resolve(undefined);
    }
    if (key === `GET ${API.me}`) return current ? Promise.resolve(current) : Promise.reject(unauthenticated());
    if (current?.id === bruno.id && pending.has(key)) return new Promise(() => {});
    const routes: Record<string, unknown> = {
      [`GET ${API.meClient}`]: { clientId: current?.id === bruno.id ? 'cb' : 'ca' },
      [`GET ${API.client('ca')}`]: detailOf('ca', 'Ana Souza', ana.email),
      [`GET ${API.client('cb')}`]: detailOf('cb', 'Bruno Costa', bruno.email),
      [`GET ${API.clientRequests('ca')}`]: [],
      [`GET ${API.clientRequests('cb')}`]: [],
    };
    if (key in routes) return Promise.resolve(routes[key]);
    return Promise.reject(new ApiRequestError(404, 'not_found', 'Recurso não encontrado.'));
  });
}

async function loginAs(email: string) {
  await userEvent.type(await screen.findByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), 'segredo123');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

function Shell() {
  const { me, logout } = useAuth();
  return (
    <>
      <p>{me?.nome}</p>
      <button type="button" onClick={() => void logout()}>
        Sair
      </button>
      <Outlet />
    </>
  );
}

function PrivateProbe({ nome }: Readonly<{ nome: string }>) {
  const { data } = useQuery({ queryKey: ['segredo'], queryFn: () => Promise.resolve(`dado de ${nome}`) });
  return <p>{data ?? 'sem dado'}</p>;
}

function PrivateArea() {
  const { me } = useAuth();
  return me ? <PrivateProbe nome={me.nome} /> : <p>sem sessão</p>;
}

describe('cache por sessão', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('depois de sair e entrar como outro usuário, não mostra os dados do anterior enquanto carrega os novos', async () => {
    const pending = new Set<string>();
    stubSessions(pending);
    renderApp(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth roles={['cliente']} />}>
          <Route element={<Shell />}>
            <Route path="/cliente" element={<MeuPainelPage />} />
          </Route>
        </Route>
      </Routes>,
      '/cliente',
    );

    await loginAs(ana.email);
    expect(await screen.findByRole('heading', { name: 'Olá, Ana.' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar na plataforma' });
    pending.add(`GET ${API.meClient}`);
    pending.add(`GET ${API.client('cb')}`);
    await loginAs(bruno.email);

    expect(await screen.findByText('Bruno Costa')).toBeInTheDocument();
    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument();
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('quando a reconsulta da sessão volta com outro usuário, nunca mostra os dados do anterior sob o novo', async () => {
    let current: Me = ana;
    const atrasadas: { dono: string; resolver: (valor: string) => void }[] = [];
    const vazamentos: string[] = [];
    mockedFetch.mockImplementation((path: string) =>
      path === API.me ? Promise.resolve(current) : Promise.reject(unauthenticated()),
    );
    const buscarSegredo = vi.fn(() => {
      const dono = current.nome;
      return new Promise<string>((resolve) => {
        atrasadas.push({ dono, resolver: resolve });
      });
    });
    function SessionProbe() {
      const { me } = useAuth();
      const { data } = useQuery({ queryKey: ['segredo'], queryFn: buscarSegredo, enabled: Boolean(me) });
      if (me && data && !data.endsWith(me.nome)) vazamentos.push(`${me.nome} viu ${data}`);
      return <p>{me ? `${me.nome}: ${data ?? 'carregando'}` : 'sem sessão'}</p>;
    }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <SessionProbe />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(atrasadas).toHaveLength(1));
    act(() => atrasadas[0]!.resolver('dado de Ana Souza'));
    expect(await screen.findByText('Ana Souza: dado de Ana Souza')).toBeInTheDocument();

    void queryClient.invalidateQueries({ queryKey: ['segredo'] });
    await waitFor(() => expect(atrasadas).toHaveLength(2));
    current = bruno;
    await act(() => queryClient.invalidateQueries({ queryKey: ME_KEY }));
    await waitFor(() => expect(atrasadas).toHaveLength(3));
    expect(atrasadas[2]!.dono).toBe('Bruno Costa');

    act(() => atrasadas[1]!.resolver('dado de Ana Souza'));
    expect(await screen.findByText('Bruno Costa: carregando')).toBeInTheDocument();
    act(() => atrasadas[2]!.resolver('dado de Bruno Costa'));
    expect(await screen.findByText('Bruno Costa: dado de Bruno Costa')).toBeInTheDocument();
    expect(vazamentos).toEqual([]);
  });

  it('quando a sessão cai sem logout, descarta as consultas privadas e mantém só a sessão', async () => {
    let current: Me | null = ana;
    mockedFetch.mockImplementation((path: string) =>
      path === API.me && current ? Promise.resolve(current) : Promise.reject(unauthenticated()),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <PrivateArea />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('dado de Ana Souza')).toBeInTheDocument();

    current = null;
    await queryClient.invalidateQueries({ queryKey: ME_KEY });

    await waitFor(() => expect(queryClient.getQueryData(['segredo'])).toBeUndefined());
    expect(queryClient.getQueryData(ME_KEY)).toBeNull();
    expect(screen.getByText('sem sessão')).toBeInTheDocument();
  });
});
