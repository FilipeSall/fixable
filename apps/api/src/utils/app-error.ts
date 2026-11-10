import type { ErrorCode } from '@fixable/shared';

export const INTERNAL_MESSAGE = 'Algo deu errado. Tente de novo.';
export const VALIDATION_MESSAGE = 'Dados inválidos.';
export const UNAUTHORIZED_MESSAGE = 'Faça login para continuar.';
export const FORBIDDEN_MESSAGE = 'Você não tem permissão para acessar este recurso.';
export const NOT_FOUND_MESSAGE = 'Recurso não encontrado.';
export const RATE_LIMITED_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';

/** Erro de negócio com status HTTP e código da API, convertido em resposta pelo handler de erros. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  /** Cria o erro com status HTTP, código e mensagem para o cliente. */
  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
