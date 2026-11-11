import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api.ts';
import { ME_KEY } from './features/auth/me-key.ts';

const HTTP_UNAUTHORIZED = 401;
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

/** Diz se a falha de uma consulta que não é a da sessão indica que a sessão caiu (401). */
function lostSession(error: unknown, queryKey: readonly unknown[]): boolean {
  return error instanceof ApiRequestError && error.status === HTTP_UNAUTHORIZED && queryKey[0] !== ME_KEY[0];
}

/** Cria o cliente do React Query com a política de repetição do app, uma só repetição para a sessão e nova consulta da sessão a cada 401. */
export function createQueryClient(): QueryClient {
  const queryCache = new QueryCache({
    onError: (error, query) => {
      if (lostSession(error, query.queryKey)) void client.invalidateQueries({ queryKey: ME_KEY });
    },
  });
  const client = new QueryClient({ queryCache, defaultOptions: { queries: { retry: retryUpTo(MAX_RETRIES) } } });
  client.setQueryDefaults(ME_KEY, { retry: retryUpTo(ME_MAX_RETRIES) });
  return client;
}
