import { describe, expect, it } from 'vitest';
import { shouldRewrite } from './spa-fallback.ts';

describe('shouldRewrite', () => {
  it('reescreve as rotas do app, inclusive /app/ e com query string', () => {
    expect(shouldRewrite('GET', '/app/')).toBe(true);
    expect(shouldRewrite('GET', '/app/login')).toBe(true);
    expect(shouldRewrite('GET', '/app/convite?token=abc')).toBe(true);
  });

  it('não reescreve a raiz /app, arquivos, outros métodos nem o site público', () => {
    expect(shouldRewrite('GET', '/app')).toBe(false);
    expect(shouldRewrite('GET', '/app/assets/main.js')).toBe(false);
    expect(shouldRewrite('POST', '/app/login')).toBe(false);
    expect(shouldRewrite('GET', '/servicos/eletrica')).toBe(false);
    expect(shouldRewrite(undefined, undefined)).toBe(false);
  });
});
