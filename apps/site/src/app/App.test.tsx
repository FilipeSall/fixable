import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { mockedFetch, unauthenticated } from './auth/test-utils.tsx';

vi.mock('./api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api.ts')>()),
  apiFetch: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockRejectedValue(unauthenticated());
  });

  it('mostra a página 404 em uma rota desconhecida', async () => {
    window.history.pushState({}, '', '/app/qualquer-coisa');
    render(<App />);
    expect(await screen.findByText('Página não encontrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/app');
  });
});
