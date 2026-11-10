import type { FastifyRequest } from 'fastify';
import type { SerializedError } from '../types/error.types.ts';

const TOKEN_PATH = /^(\/api\/auth\/tokens\/)[^/?#]+/;

/** Troca o token da URL de consulta de link por um marcador, para não vazar nos logs. */
export function redactTokenInUrl(url: string): string {
  return url.replace(TOKEN_PATH, '$1<redacted>');
}

/** Reduz a requisição aos campos seguros para log, sem o token na URL. */
export function serializeRequest(request: FastifyRequest) {
  return {
    method: request.method,
    url: redactTokenInUrl(request.url),
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  };
}

const PARAMS_MARKER = '\nparams: ';
const STACK_FRAME_MARKER = '\n    at ';
const REDACTED = '<redacted>';
const OMITTED_KEYS = new Set(['params', 'cause']);
const MAX_CAUSE_DEPTH = 5;

/** Substitui os valores dos parâmetros de query do Postgres por um marcador no texto do erro. */
function redactQueryParams(text: string): string {
  const start = text.indexOf(PARAMS_MARKER);
  if (start === -1) return text;
  const valuesStart = start + PARAMS_MARKER.length;
  const frameStart = text.indexOf(STACK_FRAME_MARKER, valuesStart);
  const tail = frameStart === -1 ? '' : text.slice(frameStart);
  return `${text.slice(0, valuesStart)}${REDACTED}${tail}`;
}

/** Serializa o erro para o log, removendo os parâmetros e seguindo a cadeia de causas até um limite. */
function serializeAt(error: Error, depth: number): SerializedError {
  const extra = Object.fromEntries(Object.entries(error).filter(([key]) => !OMITTED_KEYS.has(key)));
  const { cause } = error;
  const serializedCause = cause instanceof Error && depth < MAX_CAUSE_DEPTH ? serializeAt(cause, depth + 1) : cause;
  return {
    ...extra,
    type: error.constructor.name,
    message: redactQueryParams(error.message),
    stack: redactQueryParams(error.stack ?? ''),
    ...(cause === undefined ? {} : { cause: serializedCause }),
  };
}

/** Serializa o erro para o log sem vazar dados sensíveis. */
export function serializeError(error: Error): SerializedError {
  return serializeAt(error, 0);
}
