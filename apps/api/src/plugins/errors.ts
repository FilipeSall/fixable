import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiError, type ErrorCode } from '@fixable/shared';

const INTERNAL_MESSAGE = 'Algo deu errado. Tente de novo.';
const VALIDATION_MESSAGE = 'Dados inválidos.';
export const FORBIDDEN_MESSAGE = 'Você não tem permissão para acessar este recurso.';
const NOT_FOUND_MESSAGE = 'Recurso não encontrado.';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

type FieldIssue = { path: string[]; message: string };

const CLIENT_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'validation',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  415: 'validation',
  429: 'rate_limited',
};

const CLIENT_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  validation: VALIDATION_MESSAGE,
  unauthorized: 'Faça login para continuar.',
  forbidden: FORBIDDEN_MESSAGE,
  not_found: NOT_FOUND_MESSAGE,
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
};

function validationBody(issues: readonly FieldIssue[]): ApiError {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    if (!(key in fields)) fields[key] = issue.message;
  }
  return { error: { code: 'validation', message: VALIDATION_MESSAGE, fields } };
}

function clientErrorBody(statusCode: number): ApiError {
  const code = CLIENT_ERROR_CODES[statusCode] ?? 'validation';
  const message = CLIENT_ERROR_MESSAGES[code] ?? VALIDATION_MESSAGE;
  return { error: { code: ERROR_CODES.includes(code) ? code : 'validation', message } };
}

function clientStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const status = error.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler(() => {
    throw new AppError(404, 'not_found', NOT_FOUND_MESSAGE);
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiError = { error: { code: error.code, message: error.message } };
      return reply.status(error.statusCode).send(body);
    }
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
      return reply.status(400).send(validationBody(issues));
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const validation = error.validation as unknown as readonly { instancePath: string; message?: string }[];
      const issues = validation.map((item) => ({
        path: item.instancePath.split('/').filter(Boolean),
        message: item.message ?? VALIDATION_MESSAGE,
      }));
      return reply.status(400).send(validationBody(issues));
    }
    const clientStatus = clientStatusOf(error);
    if (clientStatus !== undefined) {
      return reply.status(clientStatus).send(clientErrorBody(clientStatus));
    }
    request.log.error({ err: error }, 'erro não tratado');
    const body: ApiError = { error: { code: 'internal', message: INTERNAL_MESSAGE } };
    return reply.status(500).send(body);
  });
}
