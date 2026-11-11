import process from 'node:process';
import { expect, test, type APIResponse } from '@playwright/test';

type MessageSummary = { ID: string; To: { Address: string }[] };

const mailpitUrl = process.env.SMOKE_MAILPIT_URL ?? '';
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? '';
const senha = 'senha-smoke-123';

test.describe.configure({ mode: 'serial' });

/** Confere os cabeçalhos de segurança que o Caddy acrescenta em toda resposta. */
function expectSecurityHeaders(res: APIResponse): void {
  const headers = res.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('same-origin');
  expect(headers['x-frame-options']).toBe('DENY');
}

/** Espera o convite chegar ao Mailpit do smoke e devolve o link com o token no fragmento. */
async function readInviteLink(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${mailpitUrl}/api/v1/messages`);
        const body = (await res.json()) as { messages: MessageSummary[] };
        id = body.messages.find((message) => message.To.some((to) => to.Address === email))?.ID;
        return id;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBeDefined();
  const res = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
  const { Text } = (await res.json()) as { Text: string };
  const link = /https:\/\/\S+\/app\/convite#token=\S+/.exec(Text)?.[0];
  if (!link) throw new Error('Link de convite não encontrado no e-mail.');
  return link;
}

test('a home abre por HTTPS, com cabeçalhos de segurança e HTML sem cache', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  expectSecurityHeaders(res);
  expect(res.headers()['cache-control']).toBe('no-cache');
  expect(res.headers()['server']).toBeUndefined();
});

test('os assets do Astro têm cache imutável', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const asset = /\/_astro\/[^"']+\.(?:css|js)/.exec(html)?.[0];
  expect(asset).toBeDefined();
  const res = await request.get(asset ?? '');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('a página de serviço por cidade abre', async ({ page }) => {
  const res = await page.goto('/servicos/eletrica/santo-andre');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Santo André');
});

test('um caminho inexistente responde 404 com a página de erro', async ({ page, request }) => {
  const res = await request.get('/caminho-que-nao-existe');
  expect(res.status()).toBe(404);
  expectSecurityHeaders(res);
  expect(res.headers()['cache-control']).toBe('no-cache');
  await page.goto('/caminho-que-nao-existe');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
});

test('a API responde atrás do Caddy e a SPA abre em deep link', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  const res = await page.goto('/app/redefinir-senha#token=invalido');
  expect(res?.status()).toBe(200);
  expect(res?.headers()['cache-control']).toBe('no-cache');
  await expect(page.getByText('Este link expirou ou já foi usado.')).toBeVisible();
});

test('o admin criado pelo CLI aceita o convite, entra e chega aos leads', async ({ page }) => {
  expect(adminEmail).not.toBe('');
  await page.goto(await readInviteLink(adminEmail));
  await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByLabel('Confirmar senha').fill(senha);
  await page.getByRole('button', { name: 'Criar senha' }).click();
  await expect(page).toHaveURL(/\/app\/admin\/leads$/);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/app\/login/);

  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app\/admin\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
});
