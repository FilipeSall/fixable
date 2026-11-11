import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api.ts';
import { ME_KEY } from './features/auth/me-key.ts';
import { createQueryClient } from './query-client.ts';

type RetryFn = (failureCount: number, error: unknown) => boolean;

describe('createQueryClient', () => {
  const client = createQueryClient();
  const defaultRetry = client.getDefaultOptions().queries?.retry as RetryFn;
  const meRetry = client.getQueryDefaults(ME_KEY).retry as RetryFn;
  const serverError = new ApiRequestError(500, 'internal', 'erro');
  const unauthorized = new ApiRequestError(401, 'unauthorized', 'não autenticado');

  it('repete até duas vezes por padrão e nunca em erro 4xx', () => {
    expect(defaultRetry(0, serverError)).toBe(true);
    expect(defaultRetry(1, serverError)).toBe(true);
    expect(defaultRetry(2, serverError)).toBe(false);
    expect(defaultRetry(0, unauthorized)).toBe(false);
  });

  it('repete a consulta de sessão uma única vez e nunca em 401', () => {
    expect(meRetry(0, serverError)).toBe(true);
    expect(meRetry(1, serverError)).toBe(false);
    expect(meRetry(0, unauthorized)).toBe(false);
  });

  it('um 401 numa consulta privada faz a sessão ser consultada de novo', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(ME_KEY, { id: 'u1' });

    await queryClient
      .query({ queryKey: ['segredo'], queryFn: () => Promise.reject(unauthorized), retry: false })
      .catch(() => undefined);

    expect(queryClient.getQueryState(ME_KEY)?.isInvalidated).toBe(true);
  });

  it('um erro que não é 401 não mexe na sessão', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(ME_KEY, { id: 'u1' });

    await queryClient
      .query({ queryKey: ['segredo'], queryFn: () => Promise.reject(serverError), retry: false })
      .catch(() => undefined);

    expect(queryClient.getQueryState(ME_KEY)?.isInvalidated).toBe(false);
  });
});
