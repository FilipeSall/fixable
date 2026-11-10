import { API } from '@fixable/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './ForgotPasswordPage.tsx';
import { mockedFetch, renderApp, unauthenticated } from './test-utils.tsx';

vi.mock('../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.ts')>()),
  apiFetch: vi.fn(),
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((path: string) =>
      path === API.me ? Promise.reject(unauthenticated()) : Promise.resolve(undefined),
    );
  });

  it('mostra a confirmação neutra após enviar', async () => {
    renderApp(
      <Routes>
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      </Routes>,
      '/esqueci-senha',
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fixable.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(
      await screen.findByText('Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.'),
    ).toBeInTheDocument();
  });

  it('mostra erro de e-mail inválido sem chamar a API', async () => {
    renderApp(
      <Routes>
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      </Routes>,
      '/esqueci-senha',
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('E-mail'), 'x');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalledWith(API.forgot, expect.anything());
  });
});
