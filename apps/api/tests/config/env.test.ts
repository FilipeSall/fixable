import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.ts';

describe('loadConfig', () => {
  const base = {
    DATABASE_URL: 'postgres://x',
    APP_ORIGIN: 'https://fixable.com.br',
    MAIL_FROM: 'Fixable <nao-responda@fixable.com.br>',
  };
  const production = {
    ...base,
    NODE_ENV: 'production',
    MAIL_DRIVER: 'smtp',
    SMTP_URL: 'smtps://mail:465',
    TEAM_EMAIL: 'equipe@fixable.com.br',
  };

  it('lança erro citando DATABASE_URL quando faltar', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('em produção exige MAIL_DRIVER=smtp', () => {
    expect(() => loadConfig({ ...production, MAIL_DRIVER: 'memory' })).toThrow(/MAIL_DRIVER/);
    expect(loadConfig(production).MAIL_DRIVER).toBe('smtp');
  });

  it('exige TEAM_EMAIL em produção', () => {
    const semEquipe = { ...production, TEAM_EMAIL: undefined };
    expect(() => loadConfig(semEquipe)).toThrow('TEAM_EMAIL é obrigatório quando NODE_ENV=production');
    expect(loadConfig(production).TEAM_EMAIL).toBe('equipe@fixable.com.br');
  });

  it('fora de produção usa equipe@fixable.local como padrão', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'test', MAIL_DRIVER: 'memory' });
    expect(config.TEAM_EMAIL).toBe('equipe@fixable.local');
  });

  it('rejeita TEAM_EMAIL que não seja e-mail', () => {
    expect(() => loadConfig({ ...production, TEAM_EMAIL: 'nao-e-email' })).toThrow(/TEAM_EMAIL/);
  });

  it('TRUST_PROXY_HOPS é um inteiro >= 0 com padrão 0', () => {
    const dev = { ...base, MAIL_DRIVER: 'memory' };
    expect(loadConfig(dev).TRUST_PROXY_HOPS).toBe(0);
    expect(loadConfig({ ...dev, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => loadConfig({ ...dev, TRUST_PROXY_HOPS: '-1' })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => loadConfig({ ...dev, TRUST_PROXY_HOPS: 'true' })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => loadConfig({ ...dev, TRUST_PROXY_HOPS: '1.5' })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it('PUBLIC_FORM_RATE_LIMIT é um inteiro positivo com padrão 5', () => {
    const dev = { ...base, MAIL_DRIVER: 'memory' };
    expect(loadConfig(dev).PUBLIC_FORM_RATE_LIMIT).toBe(5);
    expect(loadConfig(production).PUBLIC_FORM_RATE_LIMIT).toBe(5);
    expect(loadConfig({ ...dev, PUBLIC_FORM_RATE_LIMIT: '100' }).PUBLIC_FORM_RATE_LIMIT).toBe(100);
    expect(() => loadConfig({ ...dev, PUBLIC_FORM_RATE_LIMIT: '0' })).toThrow(/PUBLIC_FORM_RATE_LIMIT/);
    expect(() => loadConfig({ ...dev, PUBLIC_FORM_RATE_LIMIT: 'muitos' })).toThrow(/PUBLIC_FORM_RATE_LIMIT/);
  });

  it('TOKEN_RATE_LIMIT e LOGIN_RATE_LIMIT são inteiros positivos com padrões 20 e 10', () => {
    const dev = { ...base, MAIL_DRIVER: 'memory' };
    expect(loadConfig(production).TOKEN_RATE_LIMIT).toBe(20);
    expect(loadConfig(production).LOGIN_RATE_LIMIT).toBe(10);
    expect(loadConfig({ ...dev, TOKEN_RATE_LIMIT: '1000', LOGIN_RATE_LIMIT: '1000' })).toMatchObject({
      TOKEN_RATE_LIMIT: 1000,
      LOGIN_RATE_LIMIT: 1000,
    });
    expect(() => loadConfig({ ...dev, TOKEN_RATE_LIMIT: '0' })).toThrow(/TOKEN_RATE_LIMIT/);
    expect(() => loadConfig({ ...dev, TOKEN_RATE_LIMIT: '2.5' })).toThrow(/TOKEN_RATE_LIMIT/);
    expect(() => loadConfig({ ...dev, LOGIN_RATE_LIMIT: '-3' })).toThrow(/LOGIN_RATE_LIMIT/);
    expect(() => loadConfig({ ...dev, LOGIN_RATE_LIMIT: 'muitos' })).toThrow(/LOGIN_RATE_LIMIT/);
  });
});
