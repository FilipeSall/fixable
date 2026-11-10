import { expect, test } from '@playwright/test';
import { aguardarHidratacao } from './hydration.ts';
import { clearMailbox, readInviteLink } from './mailpit.ts';

const senha = 'senha123';
const aceite = 'Li e aceito os termos de uso e a política de privacidade.';

test.describe.configure({ mode: 'serial' });

test.beforeAll(clearMailbox);

test('visitante solicita diagnóstico com plano e cria a senha pelo convite', async ({ page }) => {
  const email = `cliente-${Date.now()}@fixable.local`;
  await page.goto('/');

  const pacote = page.locator('.pkg-card', { has: page.getByRole('heading', { name: 'Plano para 3 meses' }) });
  await pacote.getByRole('link', { name: 'Solicitar orçamento' }).click();
  await aguardarHidratacao(page, '#diagnostic-form');
  await expect(page.getByText('Plano de interesse:')).toBeVisible();
  await expect(page.locator('.plan-chip')).toContainText('Plano para 3 meses');

  const form = page.locator('#diagnostic-form');
  await form.getByLabel('Nome completo', { exact: true }).fill('Maria Cliente');
  await form.getByLabel('E-mail', { exact: true }).fill(email);
  await form.getByLabel('Telefone', { exact: true }).fill('(11) 91234-5678');
  await form.getByLabel('Cidade', { exact: true }).fill('Santo André');
  await form.getByLabel('Tipo de imóvel').selectOption('apartamento');
  await form.getByLabel('Preferência de contato').selectOption('email');
  await form.getByLabel(aceite).check();
  await form.getByRole('button', { name: 'Solicitar diagnóstico' }).click();
  await expect(page.getByText('Solicitação registrada.')).toBeVisible();

  await page.goto(await readInviteLink(email));
  await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByLabel('Confirmar senha').fill(senha);
  await page.getByRole('button', { name: 'Criar senha' }).click();
  await expect(page).toHaveURL(/\/app\/cliente$/);
});

test('candidato envia o cadastro e vê "Cadastro recebido."', async ({ page }) => {
  await page.goto('/');
  const form = page.locator('#team-form');
  await aguardarHidratacao(page, '#team-form');
  await form.getByLabel('Nome completo', { exact: true }).fill('Carlos Engenheiro');
  await form.getByLabel('E-mail', { exact: true }).fill(`candidato-${Date.now()}@fixable.local`);
  await form.getByLabel('Telefone', { exact: true }).fill('(11) 98765-4321');
  await form.getByLabel('Cidade', { exact: true }).fill('São Paulo');
  await form.getByLabel('Área de atuação', { exact: true }).selectOption('engenheiro');
  await form.getByLabel(aceite).check();
  await form.getByRole('button', { name: 'Fazer meu cadastro' }).click();
  await expect(page.getByText('Cadastro recebido.')).toBeVisible();
});

test('página Eletricista em Santo André tem a cidade pré-preenchida', async ({ page }) => {
  await page.goto('/servicos/eletrica/santo-andre');
  await expect(page.getByRole('heading', { name: 'Eletricista em Santo André' })).toBeVisible();
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Santo André');
});

test('home abre sem login e sem chamar /api/auth/me', async ({ page }) => {
  const chamadas: string[] = [];
  await page.route('**/api/auth/me', async (route) => {
    chamadas.push(route.request().url());
    await route.continue();
  });
  await page.goto('/');
  await aguardarHidratacao(page, '#diagnostic-form');
  await aguardarHidratacao(page, '#team-form');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Solicitar diagnóstico' }).last()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(chamadas).toEqual([]);
});
