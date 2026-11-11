import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { EmailBody, EmailRateLimitOptions } from '../types/auth.types.ts';
import { AppError, RATE_LIMITED_MESSAGE } from '../utils/app-error.ts';

/** Cria o preHandler que limita as tentativas por e-mail do corpo, somado ao limite por IP, contra ataque distribuído. */
export function emailRateLimit(app: FastifyInstance, options: EmailRateLimitOptions) {
  const limiter = app.createRateLimit({
    max: options.max,
    timeWindow: options.timeWindowMs,
    keyGenerator: (request) => `${options.prefix}:${(request.body as EmailBody).email}`,
  });
  return async (request: FastifyRequest): Promise<void> => {
    const result = await limiter(request);
    if (!result.isAllowed && result.isExceeded) throw new AppError(429, 'rate_limited', RATE_LIMITED_MESSAGE);
  };
}
