import { ApiRequestError } from '../api.ts';

export const GENERIC_ERROR = 'Algo deu errado. Tente de novo.';

/** Devolve a mensagem de um erro da API ou uma mensagem genérica. */
export function messageOf(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : GENERIC_ERROR;
}

/** Devolve os erros por campo enviados pelo servidor, ou um objeto vazio. */
export function serverFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiRequestError && error.fields ? error.fields : {};
}
