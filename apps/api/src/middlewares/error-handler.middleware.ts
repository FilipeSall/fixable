import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiError, type ErrorCode } from '@fixable/shared';
import {
  AppError,
  FORBIDDEN_MESSAGE,
  INTERNAL_MESSAGE,
  NOT_FOUND_MESSAGE,
  RATE_LIMITED_MESSAGE,
  UNAUTHORIZED_MESSAGE,
  VALIDATION_MESSAGE,
} from '../utils/app-error.ts';
import type { FieldIssue } from '../types/error.types.ts';

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
  unauthorized: UNAUTHORIZED_MESSAGE,
  forbidden: FORBIDDEN_MESSAGE,
  not_found: NOT_FOUND_MESSAGE,
  rate_limited: RATE_LIMITED_MESSAGE,
};

/** Monta o corpo de erro de validação com a primeira mensagem de cada campo. */
function validationBody(issues: readonly FieldIssue[]): ApiError {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    if (!(key in fields)) fields[key] = issue.message;
  }
  return { error: { code: 'validation', message: VALIDATION_MESSAGE, fields } };
}

/** Monta o corpo de erro para um status 4xx do Fastify, usando mensagens padrão em pt-BR. */
function clientErrorBody(statusCode: number): ApiError {
  const code = CLIENT_ERROR_CODES[statusCode] ?? 'validation';
  const message = CLIENT_ERROR_MESSAGES[code] ?? VALIDATION_MESSAGE;
  return { error: { code: ERROR_CODES.includes(code) ? code : 'validation', message } };
}

/** Devolve o status 4xx de um erro do Fastify ou undefined quando o erro não é do cliente. */
function clientStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const status = error.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

/** Registra o handler de 404 e o de erros, que padroniza todas as respostas de falha no formato da API. */
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
