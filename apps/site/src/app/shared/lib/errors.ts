import { ApiRequestError } from '../../api.ts';

const NOT_FOUND = 404;
const FALLBACK = 'Não foi possível concluir agora. Tente de novo.';

/** Escolhe a mensagem a exibir para um erro da API: a primeira de campo, a geral ou uma genérica. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return FALLBACK;
  const first = error.fields ? Object.values(error.fields)[0] : undefined;
  return first ?? error.message;
}

/** Diz se o erro é um 404 da API (recurso inexistente ou sem acesso). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === NOT_FOUND;
}
