import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { apiEnv } from './env.ts';
import { readInviteLink } from './mailpit.ts';

const run = promisify(execFile);
const senha = 'senha123';
const apiDir = new URL('../../api', import.meta.url).pathname;

test.describe.configure({ mode: 'serial' });

test('admin recebe convite, cria senha, entra, sai e entra de novo', async ({ page }) => {
  const email = `admin-${Date.now()}@fixable.local`;
  const { stdout } = await run(
    'node',
    ['--env-file-if-exists=../../.env', 'src/cli/create-admin.ts', '--nome', 'Ana Souza', '--email', email],
    { cwd: apiDir, env: { ...process.env, ...apiEnv } },
  );
  expect(stdout).toContain(`Convite enviado para ${email}`);

  await page.goto(await readInviteLink(email));
  await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByLabel('Confirmar senha').fill(senha);
  await page.getByRole('button', { name: 'Criar senha' }).click();

  await expect(page).toHaveURL(/\/app\/admin\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/app\/login/);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app\/admin\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
});

test('deep link de redefinição carrega a SPA', async ({ page }) => {
  await page.goto('/app/redefinir-senha#token=invalido');
  await expect(page.getByText('Este link expirou ou já foi usado.')).toBeVisible();
});

test('rota protegida sem sessão vai para login', async ({ page }) => {
  await page.goto('/app/clientes');
  await expect(page).toHaveURL(/\/app\/login\?next=%2Fclientes$/);
  await expect(page.getByRole('heading', { name: 'Entrar na plataforma' })).toBeVisible();
});
