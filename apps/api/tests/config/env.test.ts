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
});
