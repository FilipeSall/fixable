import { API } from '@fixable/shared';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api.ts';
import type { ApiInit } from '../../types/api.types.ts';
import { InvitePage } from './InvitePage.tsx';
import { AuthProvider } from './AuthProvider.tsx';
import { ResetPasswordPage } from './ResetPasswordPage.tsx';
import { ana, mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.ts')>()),
  apiFetch: vi.fn(),
}));

const tokenInfo = { purpose: 'convite', nome: 'Ana', email: 'ana@fixable.com' };

function renderInvite(route = '/convite?token=abc') {
  return renderApp(
    <Routes>
      <Route path="/convite" element={<InvitePage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="*" element={<p>destino</p>} />
    </Routes>,
    route,
  );
}

function isLookupOf(token: string, init: ApiInit | undefined): boolean {
  return init?.method === 'POST' && (init.body as { token?: string } | undefined)?.token === token;
}

function stub(info: () => Promise<unknown>, accept: () => Promise<unknown> = () => Promise.resolve(ana)) {
  mockedFetch.mockImplementation((path: string, init?: ApiInit) => {
    if (path === API.me) return Promise.reject(unauthenticated());
    if (path === API.tokenLookup && isLookupOf('abc', init)) return info();
    if (path === API.acceptInvite) return accept();
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
}

async function fillPasswords(senha: string, confirmacao: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Senha'), senha);
  await user.type(screen.getByLabelText('Confirmar senha'), confirmacao);
  await user.click(screen.getByRole('button', { name: 'Criar senha' }));
}

describe('InvitePage', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('com token válido mostra "Olá, Ana."', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite();
    expect(await screen.findByText(/Olá, Ana\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crie sua senha' })).toBeInTheDocument();
  });

  it('consulta o token por POST com o token no corpo, fora da URL', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite();
    expect(await screen.findByText(/Olá, Ana\./)).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith('/api/auth/tokens/lookup', { method: 'POST', body: { token: 'abc' } });
    const paths = mockedFetch.mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.includes('abc'))).toBe(false);
  });

  it('token 410 mostra "Este link expirou ou já foi usado."', async () => {
    stub(() => Promise.reject(new ApiRequestError(410, 'token_invalid', 'Este link expirou ou já foi usado.')));
    renderInvite();
    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/esqueci-senha');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it.each([
    ['500', new ApiRequestError(500, 'internal', 'Algo deu errado. Tente de novo.'), 'Algo deu errado. Tente de novo.'],
    [
      '429',
      new ApiRequestError(429, 'rate_limited', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'),
      'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    ],
    ['falha de rede', new TypeError('Failed to fetch'), 'Algo deu errado. Tente de novo.'],
  ])('erro %s ao validar o token mostra a mensagem e permite tentar de novo', async (_label, error, message) => {
    let calls = 0;
    stub(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(error) : Promise.resolve(tokenInfo);
    });
    renderInvite();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('Este link expirou ou já foi usado.')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/Olá, Ana\./)).toBeInTheDocument();
  });

  it('sem token na URL mostra a mensagem de link expirado', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite('/convite');
    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument();
  });

  it('token de redefinição na página de convite é rejeitado', async () => {
    stub(() => Promise.resolve({ ...tokenInfo, purpose: 'redefinicao' }));
    renderInvite();
    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument();
  });

  it('token de convite na página de redefinição é rejeitado', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite('/redefinir-senha?token=abc');
    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument();
  });

  it('senhas diferentes mostram "As senhas não conferem."', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite();
    await fillPasswords('segredo123', 'segredo124');
    expect(await screen.findByText('As senhas não conferem.')).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalledWith(API.acceptInvite, expect.anything());
  });

  it('senha fraca mostra a mensagem do schema compartilhado', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite();
    await fillPasswords('curta', 'curta');
    expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument();
  });

  it('sucesso leva à home do papel', async () => {
    stub(() => Promise.resolve(tokenInfo));
    renderInvite();
    await fillPasswords('segredo123', 'segredo123');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/cliente'));
    expect(mockedFetch).toHaveBeenCalledWith(API.acceptInvite, {
      method: 'POST',
      body: { token: 'abc', senha: 'segredo123' },
    });
  });

  it('mostra a mensagem do servidor quando o envio falha', async () => {
    stub(
      () => Promise.resolve(tokenInfo),
      () => Promise.reject(new ApiRequestError(410, 'token_invalid', 'Este link expirou ou já foi usado.')),
    );
    renderInvite();
    await fillPasswords('segredo123', 'segredo123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Este link expirou ou já foi usado.');
  });
});

function lookupCalls() {
  return mockedFetch.mock.calls.filter(([path]) => path === API.tokenLookup);
}

describe('TokenGate', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    stub(() => Promise.resolve(tokenInfo));
  });
  afterEach(() => {
    focusManager.setFocused();
    window.history.replaceState(null, '', '/');
  });

  it('voltar o foco para a janela não consulta o token de novo', async () => {
    renderInvite();
    expect(await screen.findByText(/Olá, Ana\./)).toBeInTheDocument();
    expect(lookupCalls()).toHaveLength(1);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await Promise.resolve();
    });

    expect(lookupCalls()).toHaveLength(1);
  });

  it('tira o token da URL da página e ainda envia o formulário com ele', async () => {
    window.history.replaceState(null, '', '/app/convite?token=abc&origem=email');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/app">
          <AuthProvider>
            <Routes>
              <Route path="/convite" element={<InvitePage />} />
              <Route path="*" element={<p>destino</p>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Olá, Ana\./)).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe('?origem=email'));
    expect(window.location.pathname).toBe('/app/convite');

    await fillPasswords('segredo123', 'segredo123');
    await waitFor(() => expect(window.location.pathname).toBe('/app/cliente'));
    expect(mockedFetch).toHaveBeenCalledWith(API.acceptInvite, {
      method: 'POST',
      body: { token: 'abc', senha: 'segredo123' },
    });
  });
});
