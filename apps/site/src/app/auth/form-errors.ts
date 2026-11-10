import { ApiRequestError } from '../api.ts';

export const GENERIC_ERROR = 'Algo deu errado. Tente de novo.';

export function messageOf(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : GENERIC_ERROR;
}

export function serverFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiRequestError && error.fields ? error.fields : {};
}

interface IssueSource {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}

export function fieldErrorsOf(error: IssueSource): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}
