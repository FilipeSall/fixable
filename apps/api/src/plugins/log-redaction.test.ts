import { describe, expect, it } from 'vitest';
import { redactTokenInUrl } from './log-redaction.ts';

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
