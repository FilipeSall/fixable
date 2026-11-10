import { API, HOME_BY_ROLE } from '@fixable/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api.ts';
import { useAuth } from './AuthProvider.tsx';
import { LoginPage } from './LoginPage.tsx';
import { ana, mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.ts')>()),
  apiFetch: vi.fn(),
}));

function SessionProbe() {
  const { me } = useAuth();
  return <p>{me ? `sessão de ${me.nome}` : 'sem sessão'}</p>;
}

function renderLogin(route = '/login') {
  return renderApp(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<SessionProbe />} />
    </Routes>,
    route,
  );
}

async function fillAndSubmit(email: string, senha: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), senha);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

function stubSession(onLogin: () => Promise<unknown>) {
  mockedFetch.mockImplementation((path: string) => {
    if (path === API.me) return Promise.reject(unauthenticated());
    if (path === API.login) return onLogin();
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('mostra "Informe um e-mail válido." e não chama a API com e-mail inválido', async () => {
    stubSession(() => Promise.resolve(ana));
    renderLogin();
    await fillAndSubmit('invalido', 'segredo123');
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('Informe um e-mail válido.');
    expect(mockedFetch).not.toHaveBeenCalledWith(API.login, expect.anything());
  });

  it('mostra a mensagem do servidor em 401', async () => {
    stubSession(() =>
      Promise.reject(new ApiRequestError(401, 'invalid_credentials', 'E-mail ou senha incorretos.')),
    );
    renderLogin();
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('mostra mensagem genérica quando a rede falha', async () => {
    stubSession(() => Promise.reject(new TypeError('Failed to fetch')));
    renderLogin();
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado. Tente de novo.');
  });

  it('após login vai para HOME_BY_ROLE do papel', async () => {
    stubSession(() => Promise.resolve(ana));
    renderLogin();
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(HOME_BY_ROLE.cliente.replace('/app', '')),
    );
  });

  it('após login vai para ?next quando é caminho interno', async () => {
    stubSession(() => Promise.resolve(ana));
    renderLogin('/login?next=%2Fprojetos');
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projetos'));
  });

  it('ignora ?next=//evil.com e vai para a home do papel', async () => {
    stubSession(() => Promise.resolve(ana));
    renderLogin('/login?next=%2F%2Fevil.com');
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/cliente'));
  });

  it('desabilita o botão e mostra "Entrando..." durante o envio', async () => {
    stubSession(() => new Promise(() => undefined));
    renderLogin();
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    const button = await screen.findByRole('button', { name: 'Entrando...' });
    expect(button).toBeDisabled();
  });

  it('mantém a sessão do login quando um /me sem cookie iniciado antes responde depois', async () => {
    const rejecters: ((error: unknown) => void)[] = [];
    mockedFetch.mockImplementation((path: string) => {
      if (path === API.me) {
        return new Promise((_resolve, reject) => {
          rejecters.push(reject);
        });
      }
      if (path === API.login) return Promise.resolve(ana);
      return Promise.reject(new Error(`inesperado: ${path}`));
    });
    renderLogin();
    await fillAndSubmit('ana@fixable.com', 'segredo123');
    expect(await screen.findByText('sessão de Ana Souza')).toBeInTheDocument();
    for (const reject of rejecters) reject(unauthenticated());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText('sessão de Ana Souza')).toBeInTheDocument();
  });

  it('redireciona para a home quando já há sessão', async () => {
    mockedFetch.mockResolvedValue(ana);
    renderLogin();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/cliente'));
  });
});
