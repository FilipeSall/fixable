import { API, type DemoAccount, type Me } from '@fixable/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { AppShell } from '../../shared/components/AppShell.tsx';
import { LoginPage } from './LoginPage.tsx';
import { RequireAuth } from './RequireAuth.tsx';
import { ana, mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const contas: DemoAccount[] = [
  { nome: 'Rafael Lima', email: 'rafael.demo@fixable.com.br', role: 'engenheiro', descricao: 'Engenheiro responsável pelos clientes demo' },
  { nome: 'Ana Souza', email: 'ana.demo@fixable.com.br', role: 'cliente', descricao: 'Sobrado em Santo André' },
];

function stub(demo: DemoAccount[] | null | 'pendente', me: Me | null = null) {
  let current = me;
  mockedFetch.mockImplementation((path: string) => {
    if (path === API.me) return current ? Promise.resolve(current) : Promise.reject(unauthenticated());
    if (path === API.demoAccounts) {
      if (demo === 'pendente') return new Promise(() => undefined);
      return demo ? Promise.resolve(demo) : Promise.reject(new ApiRequestError(404, 'not_found', 'Recurso não encontrado.'));
    }
    if (path === API.logout) {
      current = null;
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
}

describe('tela de login', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('no modo demo lista as contas e o clique preenche o acesso', async () => {
    stub(contas);
    renderApp(<LoginPage />, '/login');
    expect(await screen.findByRole('heading', { name: 'Contas de demonstração' })).toBeInTheDocument();
    const aviso = within(screen.getByRole('complementary')).getByRole('status');
    expect(aviso).toBeEmptyDOMElement();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Preencher acesso de Rafael Lima (Engenheiro responsável)' }));
    expect(screen.getByLabelText('E-mail')).toHaveValue('rafael.demo@fixable.com.br');
    expect(screen.getByLabelText('Senha')).toHaveValue('fixable123');
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveFocus();
    expect(aviso).toHaveTextContent('Acesso de Rafael Lima preenchido. Clique em Entrar.');
  });

  it('enquanto as contas carregam não mostra nenhum dos dois cartões', async () => {
    stub('pendente');
    renderApp(<LoginPage />, '/login');
    expect(await screen.findByRole('heading', { name: 'Entrar na plataforma' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Como ter acesso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contas de demonstração' })).not.toBeInTheDocument();
  });

  it('sem modo demo mostra como ter acesso', async () => {
    stub(null);
    renderApp(<LoginPage />, '/login');
    expect(await screen.findByRole('heading', { name: 'Como ter acesso' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitar diagnóstico' })).toHaveAttribute('href', '/#solicitar');
    expect(screen.queryByRole('heading', { name: 'Contas de demonstração' })).not.toBeInTheDocument();
  });

  it('Sair leva exatamente a /login, sem next', async () => {
    stub(contas, ana);
    renderApp(
      <Routes>
        <Route element={<RequireAuth roles={['cliente']} />}>
          <Route element={<AppShell />}>
            <Route path="/cliente" element={<h1>Painel</h1>} />
          </Route>
        </Route>
        <Route path="/login" element={<p>tela de login</p>} />
      </Routes>,
      '/cliente',
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/);
  });
});
