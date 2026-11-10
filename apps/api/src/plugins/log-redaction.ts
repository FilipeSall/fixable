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
