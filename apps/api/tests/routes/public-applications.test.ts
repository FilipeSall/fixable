import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applications, emailOutbox, users } from '../../src/models/index.ts';
import { createUser, resetDb, testApp, type TestApp } from '../helpers.ts';

const ORIGIN = 'http://localhost:4321';
const URL_CANDIDATURA = '/api/public/applications';

const envio = {
  nome: ' Bruno Alves ',
  email: ' Bruno@Ex.com ',
  telefone: '(11) 91111-2222',
  cidade: 'São Bernardo do Campo',
  area: 'engenheiro',
  aceiteTermos: true,
};

let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
});
afterEach(async () => {
  await t.close();
});

function enviar(payload: object = envio, headers: Record<string, string> = { origin: ORIGIN }) {
  return t.app.inject({ method: 'POST', url: URL_CANDIDATURA, headers, payload });
}

describe('POST /api/public/applications', () => {
  it('candidatura cria registro pendente, avisa a equipe e não cria usuário', async () => {
    const antes = Date.now();

    const response = await enviar();

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    const [candidatura, ...outras] = await t.db.select().from(applications);
    expect(outras).toHaveLength(0);
    expect(candidatura).toMatchObject({
      nome: 'Bruno Alves',
      email: 'bruno@ex.com',
      telefone: '11911112222',
      cidade: 'São Bernardo do Campo',
      area: 'engenheiro',
      status: 'pendente',
    });
    expect(candidatura!.consentAt.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(await t.db.select().from(users)).toHaveLength(0);

    const fila = await t.db.select().from(emailOutbox);
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ to: 'equipe@fixable.local', template: 'nova-candidatura' });
    expect(fila[0]!.data).toEqual({
      nome: 'Bruno Alves',
      email: 'bruno@ex.com',
      telefone: '11911112222',
      cidade: 'São Bernardo do Campo',
      area: 'Engenheiro',
    });
  });

  it('candidatura com e-mail de usuário já existente também é gravada, sem criar nem alterar usuário', async () => {
    await createUser(t.db, { role: 'cliente', email: 'bruno@ex.com', nome: 'Bruno Cliente' });
    const usuariosAntes = await t.db.select().from(users);

    const response = await enviar({ ...envio, area: 'outro' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await t.db.select().from(users)).toEqual(usuariosAntes);
    const [candidatura] = await t.db.select().from(applications);
    expect(candidatura).toMatchObject({ email: 'bruno@ex.com', area: 'outro', status: 'pendente' });
    const [aviso] = await t.db.select().from(emailOutbox);
    expect((aviso!.data as { area: string }).area).toBe('Outro');
  });

  it('honeypot preenchido: 204 sem gravar candidatura nem e-mail', async () => {
    const response = await enviar({ ...envio, website: 'robo' });

    expect(response.statusCode).toBe(204);
    expect(await t.db.select().from(applications)).toHaveLength(0);
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('corpo inválido: 400 com a mensagem da área', async () => {
    const response = await enviar({ ...envio, area: '' });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { fields: Record<string, string> } }>().error.fields).toMatchObject({
      area: 'Selecione sua área de atuação.',
    });
  });

  it('6º envio do mesmo IP em 15 min: 429', async () => {
    for (let envioAtual = 1; envioAtual <= 5; envioAtual += 1) {
      expect((await enviar({ ...envio, email: `bruno${envioAtual}@ex.com` })).statusCode).toBe(204);
    }
    const sexto = await enviar();
    expect(sexto.statusCode).toBe(429);
    expect(await t.db.select().from(applications)).toHaveLength(5);
  });

  it('sem Origin: 403', async () => {
    const response = await enviar(envio, {});
    expect(response.statusCode).toBe(403);
    expect(await t.db.select().from(applications)).toHaveLength(0);
  });
});
