import { API } from '@fixable/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage.tsx';
import { ResetPasswordPage } from './ResetPasswordPage.tsx';
import { ana, mockedFetch, renderApp } from './test-utils.tsx';

vi.mock('../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.ts')>()),
  apiFetch: vi.fn(),
}));

const tokenInfo = { purpose: 'redefinicao', nome: 'Ana', email: 'ana@fixable.com' };

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((path: string) => {
      if (path === API.me) return Promise.resolve(ana);
      if (path === API.tokenInfo('abc')) return Promise.resolve(tokenInfo);
      if (path === API.reset) return Promise.resolve(undefined);
      return Promise.reject(new Error(`inesperado: ${path}`));
    });
  });

  it('com sessão aberta, depois de redefinir leva ao login com o aviso', async () => {
    renderApp(
      <Routes>
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<p>destino</p>} />
      </Routes>,
      '/redefinir-senha?token=abc',
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Senha'), 'segredo123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(await screen.findByText('Senha redefinida. Entre com a nova senha.')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith(API.reset, { method: 'POST', body: { token: 'abc', senha: 'segredo123' } });
  });
});
