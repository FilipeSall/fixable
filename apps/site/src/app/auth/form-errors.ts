import type { IssueSource } from '../../types/forms.types.ts';
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

/** Converte os problemas de validação do Zod em uma mensagem por campo. */
export function fieldErrorsOf(error: IssueSource): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}
