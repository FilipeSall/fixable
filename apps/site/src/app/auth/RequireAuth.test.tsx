import { API } from '@fixable/shared';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth.tsx';
import { ana, mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.ts')>()),
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
});
