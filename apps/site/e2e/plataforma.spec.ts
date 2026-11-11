import { expect, test } from '@playwright/test';
import {
  aceitarConvite,
  criarAdmin,
  enviarCandidatura,
  entrar,
  hojeIso,
  solicitarDiagnostico,
} from './fixtures.ts';

const id = Date.now();
const letras = [...String(id)].map((digito) => 'abcdefghij'[Number(digito)]).join('');
const admin = { nome: 'Ana Souza', email: `admin-${id}@fixable.local` };
const engenheiro = { nome: `Eng${letras} Silva`, email: `eng-${id}@fixable.local` };
const cliente = { nome: `Cliente${letras} Souza`, email: `cli-${id}@fixable.local` };
const candidato = { nome: `Candidato${letras} Lima`, email: `cand-${id}@fixable.local` };
const comodo = `Sala${id}`;
const servico = `Trocar torneira ${id}`;
const agendamento = `Visita técnica ${id}`;
const solicitacao = `Infiltração no banheiro ${id}`;

test.describe.configure({ mode: 'serial' });

test('admin convida um engenheiro, que aceita o convite e cai em Clientes', async ({ page }) => {
  await criarAdmin(admin.nome, admin.email);
  await aceitarConvite(page, admin.email);
  await expect(page).toHaveURL(/\/app\/admin\/leads$/);

  await page.getByRole('link', { name: 'Equipe' }).click();
  await page.getByRole('button', { name: 'Convidar pessoa' }).click();
  await page.getByLabel('Nome completo').fill(engenheiro.nome);
  await page.getByLabel('E-mail').fill(engenheiro.email);
  await page.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(page.getByText(`Convite enviado para ${engenheiro.email}.`)).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();

  await aceitarConvite(page, engenheiro.email);
  await expect(page).toHaveURL(/\/app\/clientes$/);
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
});

test('diagnóstico do visitante é atribuído ao engenheiro novo e aparece nos leads do admin', async ({ page }) => {
  await solicitarDiagnostico(page, cliente.nome, cliente.email);

  await entrar(page, admin.email);
  await expect(page).toHaveURL(/\/app\/admin\/leads$/);
  const lead = page.locator('.row-card', { hasText: cliente.email });
  await expect(lead).toBeVisible();
  await expect(
    lead,
    'o lead foi para outro engenheiro: há um engenheiro ativo sem clientes no banco de dev (veja "O e2e e os engenheiros que já estão no banco de dev" no README)',
  ).toContainText(engenheiro.nome);
});

test('engenheiro adiciona cômodo, serviço, agendamento e muda a solicitação do cliente', async ({ page }) => {
  await entrar(page, engenheiro.email);
  await page.getByRole('link', { name: new RegExp(cliente.nome) }).click();
  await expect(page.getByRole('heading', { name: cliente.nome })).toBeVisible();

  await page.getByRole('tab', { name: 'Serviços em andamento' }).click();
  await page.getByRole('button', { name: '+ Adicionar cômodo' }).click();
  await page.getByLabel('Nome do cômodo').fill(comodo);
  await page.getByRole('button', { name: 'Adicionar cômodo', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${comodo} — `) }).click();
  await page.getByRole('button', { name: '+ Adicionar serviço' }).click();
  await page.getByLabel('Tarefa', { exact: true }).fill(servico);
  await page.getByRole('button', { name: 'Adicionar serviço', exact: true }).click();
  await expect(page.getByText('Serviço salvo na maquete.')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${comodo} — 1 serviço`) })).toBeVisible();

  await page.getByRole('tab', { name: 'Agendamentos' }).click();
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  await page.getByLabel('Serviço agendado').fill(agendamento);
  await page.getByLabel('Data', { exact: true }).fill(hojeIso());
  await page.getByRole('button', { name: 'Agendar' }).click();
  await expect(page.getByText('Agendamento salvo.', { exact: false })).toBeVisible();
  await expect(page.getByText(agendamento).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Solicitações' }).click();
  await page.getByRole('button', { name: 'Nova solicitação' }).click();
  await page.getByLabel('O que foi solicitado').fill(solicitacao);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByText('Solicitação adicionada.')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(solicitacao) }).click();
  await page.getByLabel('Status da atividade').selectOption({ label: 'Agendado' });
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Solicitação atualizada.')).toBeVisible();
});

test('cliente aceita o convite e vê tudo somente para leitura', async ({ page }) => {
  await aceitarConvite(page, cliente.email);
  await expect(page).toHaveURL(/\/app\/cliente$/);
  await expect(page.getByRole('heading', { name: `Olá, ${cliente.nome.split(' ')[0]}.` })).toBeVisible();

  const linhaSolicitacao = page.locator('.row-card', { hasText: solicitacao });
  await expect(linhaSolicitacao).toContainText('Agendado');
  await expect(page.getByRole('button', { name: 'Nova solicitação' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(solicitacao) })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Serviços em andamento' }).click();
  await expect(page.getByText(servico).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Adicionar cômodo' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Agendamentos' }).click();
  await expect(page.getByText(agendamento).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo agendamento' })).toHaveCount(0);
});

test('admin aprova uma candidatura pendente', async ({ page }) => {
  await enviarCandidatura(page, candidato.nome, candidato.email);

  await entrar(page, admin.email);
  await page.getByRole('link', { name: 'Candidaturas' }).click();
  const linha = page.locator('.row-card', { hasText: candidato.email });
  await linha.getByRole('button', { name: 'Aprovar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByText(`Candidatura aprovada. Convite enviado para ${candidato.email}.`)).toBeVisible();

  await page.getByRole('tab', { name: 'Aprovadas' }).click();
  await expect(page.locator('.row-card', { hasText: candidato.email })).toBeVisible();
});
