import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError } from '@fixable/shared';

const INTERNAL_MESSAGE = 'Algo deu errado. Tente de novo.';
const VALIDATION_MESSAGE = 'Confira os campos e tente de novo.';

function fieldsFromIssues(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

function validationBody(issues: readonly { path: PropertyKey[]; message: string }[]): ApiError {
  return { error: { code: 'validation', message: VALIDATION_MESSAGE, fields: fieldsFromIssues(issues) } };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send(validationBody(error.issues));
    }
    request.log.error({ err: error }, 'erro não tratado');
    const body: ApiError = { error: { code: 'internal', message: INTERNAL_MESSAGE } };
    return reply.status(500).send(body);
  });
}
