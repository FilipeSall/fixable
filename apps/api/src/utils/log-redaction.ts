import type { FastifyRequest } from 'fastify';

const TOKEN_PATH = /^(\/api\/auth\/tokens\/)[^/?#]+/;

export function redactTokenInUrl(url: string): string {
  return url.replace(TOKEN_PATH, '$1<redacted>');
}

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

export type SerializedError = { type: string; message: string; stack: string; [key: string]: unknown };

function redactQueryParams(text: string): string {
  const start = text.indexOf(PARAMS_MARKER);
  if (start === -1) return text;
  const valuesStart = start + PARAMS_MARKER.length;
  const frameStart = text.indexOf(STACK_FRAME_MARKER, valuesStart);
  const tail = frameStart === -1 ? '' : text.slice(frameStart);
  return `${text.slice(0, valuesStart)}${REDACTED}${tail}`;
}

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

export function serializeError(error: Error): SerializedError {
  return serializeAt(error, 0);
}
