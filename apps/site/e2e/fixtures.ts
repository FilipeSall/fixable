import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, type Locator, type Page } from '@playwright/test';
import { apiEnv } from './env.ts';
import { aguardarHidratacao } from './hydration.ts';
import { readInviteLink } from './mailpit.ts';

const run = promisify(execFile);
const apiDir = new URL('../../api', import.meta.url).pathname;

export const senha = 'senha123';
const aceite = 'Li e aceito os termos de uso e a política de privacidade.';

/** Cria um administrador pelo CLI da API, que envia o convite por e-mail. */
export async function criarAdmin(nome: string, email: string): Promise<void> {
  const { stdout } = await run(
    'node',
    ['--env-file-if-exists=../../.env', 'src/cli/create-admin.ts', '--nome', nome, '--email', email],
    { cwd: apiDir, env: { ...process.env, ...apiEnv } },
  );
  expect(stdout).toContain(`Convite enviado para ${email}`);
}

/** Abre o convite recebido por e-mail e cria a senha; a página termina já logada. */
export async function aceitarConvite(page: Page, email: string): Promise<void> {
  await page.goto(await readInviteLink(email));
  await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByLabel('Confirmar senha').fill(senha);
  await page.getByRole('button', { name: 'Criar senha' }).click();
}

/** Entra na plataforma com e-mail e a senha padrão das fixtures. */
export async function entrar(page: Page, email: string): Promise<void> {
  await page.goto('/app/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Abre o select customizado pelo rótulo e escolhe a opção pelo nome. */
export async function escolher(form: Locator, rotulo: string, opcao: string): Promise<void> {
  await form.getByRole('combobox', { name: rotulo }).click();
  await form.getByRole('option', { name: opcao, exact: true }).click();
}

/** Envia o formulário público de diagnóstico e espera a confirmação. */
export async function solicitarDiagnostico(page: Page, nome: string, email: string): Promise<void> {
  await page.goto('/');
  await aguardarHidratacao(page, '#diagnostic-form');
  const form = page.locator('#diagnostic-form');
  await form.getByLabel('Nome completo', { exact: true }).fill(nome);
  await form.getByLabel('E-mail', { exact: true }).fill(email);
  await form.getByLabel('Telefone', { exact: true }).fill('(11) 91234-5678');
  await form.getByLabel('Cidade', { exact: true }).fill('Santo André');
  await escolher(form, 'Tipo de imóvel', 'Apartamento');
  await escolher(form, 'Preferência de contato', 'E-mail');
  await form.getByLabel(aceite).check();
  await form.getByRole('button', { name: 'Solicitar diagnóstico' }).click();
  await expect(page.getByText('Solicitação registrada.')).toBeVisible();
}

/** Envia o cadastro do "Faça parte do time" como área "Outro" e espera a confirmação. */
export async function enviarCandidatura(page: Page, nome: string, email: string): Promise<void> {
  await page.goto('/');
  await aguardarHidratacao(page, '#team-form');
  const form = page.locator('#team-form');
  await form.getByLabel('Nome completo', { exact: true }).fill(nome);
  await form.getByLabel('E-mail', { exact: true }).fill(email);
  await form.getByLabel('Telefone', { exact: true }).fill('(11) 98765-4321');
  await form.getByLabel('Cidade', { exact: true }).fill('São Paulo');
  await escolher(form, 'Área de atuação', 'Outro');
  await form.getByLabel(aceite).check();
  await form.getByRole('button', { name: 'Fazer meu cadastro' }).click();
  await expect(page.getByText('Cadastro recebido.')).toBeVisible();
}

/** Data de hoje no formato AAAA-MM-DD, no fuso local, para cair no mês exibido do calendário. */
export function hojeIso(): string {
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mes}-${dia}`;
}
