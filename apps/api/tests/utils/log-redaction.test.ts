import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { redactTokenInUrl, serializeError } from '../../src/utils/log-redaction.ts';

describe('redactTokenInUrl', () => {
  it('oculta o token em /api/auth/tokens/:token', () => {
    expect(redactTokenInUrl('/api/auth/tokens/abc_DEF-123')).toBe('/api/auth/tokens/<redacted>');
  });

  it('oculta o token mantendo a query string', () => {
    expect(redactTokenInUrl('/api/auth/tokens/abc?x=1')).toBe('/api/auth/tokens/<redacted>?x=1');
  });

  it('não altera outras URLs', () => {
    expect(redactTokenInUrl('/api/auth/me')).toBe('/api/auth/me');
    expect(redactTokenInUrl('/api/auth/tokens')).toBe('/api/auth/tokens');
  });
});

describe('serializeError', () => {
  const params = ['ana@fixable.com', 'hash-secreto'];
  const cause = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
  const error = new DrizzleQueryError('insert into "users" ("email", "password_hash") values ($1, $2)', params, cause);

  it('remove params e oculta os valores na mensagem e no stack de erros de query', () => {
    const serialized = serializeError(error);
    const text = JSON.stringify(serialized);
    expect(serialized).not.toHaveProperty('params');
    expect(text).not.toContain('ana@fixable.com');
    expect(text).not.toContain('hash-secreto');
    expect(serialized).toMatchObject({
      type: 'DrizzleQueryError',
      message: 'Failed query: insert into "users" ("email", "password_hash") values ($1, $2)\nparams: <redacted>',
      query: 'insert into "users" ("email", "password_hash") values ($1, $2)',
      cause: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });
    expect(serialized.stack).toMatch(/params: <redacted>\n\s+at /);
  });

  it('mantém erros comuns intactos', () => {
    expect(serializeError(new TypeError('falhou'))).toMatchObject({ type: 'TypeError', message: 'falhou' });
  });
});
