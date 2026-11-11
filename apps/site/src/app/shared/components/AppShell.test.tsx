import { API, type Me } from '@fixable/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ana, mockedFetch, renderApp, unauthenticated } from '../../features/auth/test-utils.tsx';
import { AppShell } from './AppShell.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const rafael: Me = { ...ana, nome: 'Rafael Lima', role: 'engenheiro' };
const bia: Me = { ...ana, nome: 'Bia Admin', role: 'admin' };

function renderShell(me: Me) {
  let loggedOut = false;
  mockedFetch.mockImplementation((path: string) => {
    if (path === API.me) return loggedOut ? Promise.reject(unauthenticated()) : Promise.resolve(me);
    if (path === API.logout) {
      loggedOut = true;
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/inicio" element={<h1>Conteúdo</h1>} />
      </Route>
      <Route path="/login" element={<p>tela de login</p>} />
    </Routes>,
    '/inicio',
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('cliente: sem barra lateral, com o rótulo do painel', async () => {
    renderShell(ana);
    expect(await screen.findByText('Painel do cliente')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Navegação da plataforma' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conteúdo' })).toBeInTheDocument();
  });

  it('engenheiro: barra lateral com Clientes e Calendário', async () => {
    renderShell(rafael);
    const side = await screen.findByRole('complementary', { name: 'Navegação da plataforma' });
    expect(within(side).getByText('Gestão')).toBeInTheDocument();
    expect(within(side).getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes');
    expect(within(side).getByRole('link', { name: 'Calendário' })).toHaveAttribute('href', '/calendario');
  });

  it('admin: barra lateral com Leads, Candidaturas e Equipe', async () => {
    renderShell(bia);
    const side = await screen.findByRole('complementary', { name: 'Navegação da plataforma' });
    expect(within(side).getAllByRole('link').map((link) => link.textContent)).toEqual(['Leads', 'Candidaturas', 'Equipe']);
    expect(screen.getByText('Painel do administrador')).toBeInTheDocument();
  });

  it('Sair encerra a sessão e leva ao login', async () => {
    renderShell(rafael);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith(API.logout, { method: 'POST' });
  });
});
