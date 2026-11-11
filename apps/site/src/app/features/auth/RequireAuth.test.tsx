import { API, type Me } from '@fixable/shared';
import { useQueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { AppShell } from '../../shared/components/AppShell.tsx';
import { ME_KEY } from './me-key.ts';
import { RequireAuth } from './RequireAuth.tsx';
import { RootRedirect } from './RootRedirect.tsx';
import { ana, mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

function renderGuarded(route: string) {
  return renderApp(
    <Routes>
      <Route element={<RequireAuth roles={['engenheiro']} />}>
        <Route path="/clientes" element={<p>área do engenheiro</p>} />
      </Route>
      <Route element={<RequireAuth roles={['admin']} />}>
        <Route path="/admin" element={<p>área do admin</p>} />
      </Route>
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<p>outra</p>} />
    </Routes>,
    route,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('sem sessão redireciona para /login?next=/clientes', async () => {
    mockedFetch.mockImplementation((path: string) =>
      path === API.me ? Promise.reject(unauthenticated()) : Promise.reject(new Error(path)),
    );
    renderGuarded('/clientes');
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? '';
      const url = new URL(location, 'https://x');
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('next')).toBe('/clientes');
    });
  });

  it('cliente acessando /admin vai para /cliente', async () => {
    mockedFetch.mockResolvedValue(ana);
    renderGuarded('/admin');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/cliente'));
    expect(screen.queryByText('área do admin')).not.toBeInTheDocument();
  });

  it('papel permitido renderiza a rota', async () => {
    mockedFetch.mockResolvedValue({ ...ana, role: 'engenheiro' });
    renderGuarded('/clientes');
    expect(await screen.findByText('área do engenheiro')).toBeInTheDocument();
  });

  it.each([
    ['500', new ApiRequestError(500, 'internal', 'Algo deu errado. Tente de novo.')],
    ['falha de rede', new TypeError('Failed to fetch')],
  ])('erro %s ao verificar a sessão mostra o aviso e não redireciona', async (_label, error) => {
    mockedFetch.mockRejectedValue(error);
    renderGuarded('/clientes');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar sua sessão.');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/clientes');
    expect(screen.queryByText('área do engenheiro')).not.toBeInTheDocument();
  });

  it('"Tentar de novo" com sucesso mostra a rota protegida', async () => {
    mockedFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ ...ana, role: 'engenheiro' });
    renderGuarded('/clientes');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('área do engenheiro')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível verificar sua sessão.')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/clientes');
  });

  it('erro ao verificar a sessão na raiz do app também mostra o aviso em vez de ir para o login', async () => {
    mockedFetch.mockRejectedValue(new ApiRequestError(503, 'internal', 'Algo deu errado. Tente de novo.'));
    renderGuarded('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar sua sessão.');
    expect(screen.getByTestId('location').textContent).toBe('/');
  });
});

/** Botão de teste que reconsulta a sessão, como o React Query faz ao voltar o foco para a janela. */
function SessionRefetch() {
  const queryClient = useQueryClient();
  return (
    <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ME_KEY })}>
      Reconsultar sessão
    </button>
  );
}

function renderShell() {
  return renderApp(
    <>
      <Routes>
        <Route element={<RequireAuth roles={['cliente']} />}>
          <Route element={<AppShell />}>
            <Route path="/cliente" element={<h1>Painel</h1>} />
          </Route>
        </Route>
        <Route
          path="/login"
          element={
            <>
              <p>tela de login</p>
              <Link to="/cliente">Voltar ao painel</Link>
            </>
          }
        />
      </Routes>
      <SessionRefetch />
    </>,
    '/cliente',
  );
}

function stubSession(initial: Me | null) {
  const session = { current: initial };
  mockedFetch.mockImplementation((path: string) => {
    if (path === API.me) return session.current ? Promise.resolve(session.current) : Promise.reject(unauthenticated());
    if (path === API.logout) {
      session.current = null;
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
  return session;
}

describe('saída da sessão', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('Sair leva exatamente a /login, sem next', async () => {
    stubSession(ana);
    renderShell();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/);
  });

  it('depois de Sair, uma sessão que volta pela reconsulta e expira de novo leva ao login com next', async () => {
    const session = stubSession(ana);
    renderShell();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('tela de login')).toBeInTheDocument();

    session.current = ana;
    await user.click(screen.getByRole('button', { name: 'Reconsultar sessão' }));
    await user.click(screen.getByRole('link', { name: 'Voltar ao painel' }));
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();

    session.current = null;
    await user.click(screen.getByRole('button', { name: 'Reconsultar sessão' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?next=%2Fcliente'));
  });
});
