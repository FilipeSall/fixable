import type { IssueSource } from '../types/forms.types.ts';

/** Converte os problemas de validação do Zod em uma mensagem por campo. */
export function fieldErrorsOf(error: IssueSource): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}
