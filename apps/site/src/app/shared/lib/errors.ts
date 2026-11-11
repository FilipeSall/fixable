import { ApiRequestError } from '../../api.ts';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const FALLBACK = 'Não foi possível concluir agora. Tente de novo.';

/** Escolhe a mensagem a exibir para um erro da API: a primeira de campo, a geral ou uma genérica. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return FALLBACK;
  const first = error.fields ? Object.values(error.fields)[0] : undefined;
  return first ?? error.message;
}

/** Diz se o recurso não existe para o usuário: 404 da API ou 400 de identificador inválido. */
export function isMissing(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === NOT_FOUND || error.status === BAD_REQUEST);
}
