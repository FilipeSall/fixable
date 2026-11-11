import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api.ts';
import { ME_KEY } from './features/auth/me-key.ts';

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const MAX_RETRIES = 2;
const ME_MAX_RETRIES = 1;

/** Monta a política de repetição do React Query: nunca em erro 4xx e até o limite informado nos demais casos. */
function retryUpTo(maxRetries: number): (failureCount: number, error: unknown) => boolean {
  return (failureCount, error) => {
    if (
      error instanceof ApiRequestError &&
      error.status >= HTTP_CLIENT_ERROR_MIN &&
      error.status < HTTP_SERVER_ERROR_MIN
    ) {
      return false;
    }
    return failureCount < maxRetries;
  };
}

/** Cria o cliente do React Query com a política de repetição do app e uma só repetição para a sessão. */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: retryUpTo(MAX_RETRIES) } } });
  client.setQueryDefaults(ME_KEY, { retry: retryUpTo(ME_MAX_RETRIES) });
  return client;
}
