import { API } from '@fixable/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ana, mockedFetch, renderApp, unauthenticated } from '../auth/test-utils.tsx';
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
      loggedOut = true;
      return logout();
    }
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
}

async function logoutFromHome() {
  renderApp(
    <Routes>
      <Route path="/cliente" element={<HomeScreen />} />
      <Route path="/login" element={<p>tela de login</p>} />
    </Routes>,
    '/cliente',
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Sair' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/));
}

describe('HomeScreen logout', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('limpa a sessão e navega para /login', async () => {
    stub(() => Promise.resolve(undefined));
    await logoutFromHome();
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('limpa a sessão e navega para /login mesmo se a API falhar, sem rejeição não tratada', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    stub(() => Promise.reject(new TypeError('Failed to fetch')));
    await logoutFromHome();
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });
});
