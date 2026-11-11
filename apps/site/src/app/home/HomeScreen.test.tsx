import { API } from '@fixable/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ana, mockedFetch, renderApp, unauthenticated } from '../features/auth/test-utils.tsx';
import { HomeScreen } from './HomeScreen.tsx';

vi.mock('../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.ts')>()),
  apiFetch: vi.fn(),
}));

function stub(logout: () => Promise<unknown>) {
  let loggedOut = false;
  mockedFetch.mockImplementation((path: string) => {
    if (path === API.me) return loggedOut ? Promise.reject(unauthenticated()) : Promise.resolve(ana);
    if (path === API.logout) {
      return logout().then((result) => {
        loggedOut = true;
        return result;
      });
    }
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
}

function renderHome() {
  renderApp(
    <Routes>
      <Route path="/cliente" element={<HomeScreen />} />
      <Route path="/login" element={<p>tela de login</p>} />
    </Routes>,
    '/cliente',
  );
}

async function clickLeave() {
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
}

describe('HomeScreen logout', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('limpa a sessão e navega para /login', async () => {
    stub(() => Promise.resolve(undefined));
    renderHome();
    await clickLeave();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/));
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('não sai e mostra o erro quando a API não revoga a sessão, sem rejeição não tratada', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    stub(() => Promise.reject(new TypeError('Failed to fetch')));
    renderHome();
    await clickLeave();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair. Verifique a conexão e tente de novo.',
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/cliente$/);
    expect(screen.getByText('Olá, Ana.')).toBeInTheDocument();
  });

  it('sai na nova tentativa depois de uma falha', async () => {
    let calls = 0;
    stub(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(undefined);
    });
    renderHome();
    await clickLeave();
    await screen.findByRole('alert');
    await clickLeave();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/));
  });
});
