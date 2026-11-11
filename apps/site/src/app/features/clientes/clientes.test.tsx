import { API, type ClientDetail, type ClientListResponse, type Me, type PropertyAttribute, type ServiceRequest } from '@fixable/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { ToastProvider } from '../../shared/components/Toast.tsx';
import { ana, mockedFetch, renderApp } from '../auth/test-utils.tsx';
import { ClientePage } from './pages/ClientePage.tsx';
import { ClientesPage } from './pages/ClientesPage.tsx';
import { MeuPainelPage } from './pages/MeuPainelPage.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const rafael: Me = { ...ana, nome: 'Rafael Lima', role: 'engenheiro' };
const CLIENT_ID = 'c1';

const list: ClientListResponse = {
  stats: { clientes: 2, solicitacoesAbertas: 3, servicosEmAndamento: 1, agendamentosAConfirmar: 1 },
  clients: [
    { id: CLIENT_ID, nome: 'Ana Souza', tipoImovel: 'sobrado', cidade: 'Santo André', novo: true, servicosAtivos: 1, solicitacoesAbertas: 2 },
    { id: 'c2', nome: 'Carlos Mendes', tipoImovel: null, cidade: null, novo: false, servicosAtivos: 0, solicitacoesAbertas: 0 },
  ],
};

const detail: ClientDetail = {
  id: CLIENT_ID,
  nome: 'Ana Souza',
  email: 'ana@fixable.com',
  telefone: null,
  engenheiro: { nome: 'Rafael Lima' },
  properties: [
    { id: 'p1', apelido: 'Sobrado · Santo André', tipo: 'sobrado', cidade: 'Santo André' },
    { id: 'p2', apelido: 'Apartamento · São Paulo', tipo: 'apartamento', cidade: 'São Paulo' },
  ],
};

const attributes: Record<string, PropertyAttribute[]> = {
  p1: [{ id: 'a1', chave: 'Área construída', valor: '180 m²' }],
  p2: [{ id: 'a2', chave: 'Andar', valor: '12º' }],
};

const requests: ServiceRequest[] = [
  { id: 'r1', descricao: 'Diagnóstico inicial — Sobrado', status: 'em_analise', propertyId: 'p1', propertyApelido: 'Sobrado · Santo André', createdAt: '2026-11-05T12:00:00.000Z' },
];

type Init = { method?: string; body?: unknown } | undefined;

function stubApi(me: Me, overrides: Record<string, (init: Init) => unknown> = {}) {
  mockedFetch.mockImplementation((path: string, init?: Init) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = overrides[key];
    if (handler) return Promise.resolve(handler(init));
    const routes: Record<string, unknown> = {
      [`GET ${API.me}`]: me,
      [`GET ${API.clients}`]: list,
      [`GET ${API.client(CLIENT_ID)}`]: detail,
      [`GET ${API.meClient}`]: { clientId: CLIENT_ID },
      [`GET ${API.clientRequests(CLIENT_ID)}`]: requests,
      [`GET ${API.propertyAttributes('p1')}`]: attributes.p1,
      [`GET ${API.propertyAttributes('p2')}`]: attributes.p2,
    };
    if (key in routes) return Promise.resolve(routes[key]);
    return Promise.reject(new ApiRequestError(404, 'not_found', 'Recurso não encontrado.'));
  });
}

function renderAt(route: string) {
  renderApp(
    <ToastProvider>
      <Routes>
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/:clientId" element={<ClientePage />} />
        <Route path="/cliente" element={<MeuPainelPage />} />
      </Routes>
    </ToastProvider>,
    route,
  );
}

describe('clientes', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('lista com os números de resumo e os cartões com contadores', async () => {
    stubApi(rafael);
    renderAt('/clientes');
    expect(await screen.findByText('Clientes vinculados')).toBeInTheDocument();
    const card = screen.getByRole('link', { name: 'Abrir a página de Ana Souza' });
    expect(within(card).getByText('Sobrado · Santo André')).toBeInTheDocument();
    expect(within(card).getByText('Novo cliente')).toBeInTheDocument();
    expect(within(card).getByText('1 serviço ativo')).toBeInTheDocument();
    expect(within(card).getByText('2 solicitações abertas')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: 'Abrir a página de Carlos Mendes' })).getByText('Sem serviços ativos')).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há clientes', async () => {
    stubApi(rafael, { [`GET ${API.clients}`]: () => ({ ...list, clients: [] }) });
    renderAt('/clientes');
    expect(await screen.findByText(/Nenhum cliente vinculado ainda/)).toBeInTheDocument();
  });

  it('engenheiro abre o cliente, troca de imóvel e vê os dados do imóvel escolhido', async () => {
    stubApi(rafael);
    renderAt(`/clientes/${CLIENT_ID}`);
    expect(await screen.findByRole('heading', { name: 'Ana Souza' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Dados da residência' }));
    expect(await screen.findByText('180 m²')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apartamento · São Paulo' }));
    expect(await screen.findByText('12º')).toBeInTheDocument();
    expect(screen.queryByText('180 m²')).not.toBeInTheDocument();
  });

  it('cliente de outro engenheiro mostra "Página não encontrada."', async () => {
    stubApi(rafael);
    renderAt('/clientes/outro');
    expect(await screen.findByText('Página não encontrada.')).toBeInTheDocument();
  });

  it('engenheiro adiciona uma solicitação e vê o aviso', async () => {
    const created = vi.fn(() => ({ ...requests[0], id: 'r2' }));
    stubApi(rafael, { [`POST ${API.clientRequests(CLIENT_ID)}`]: created });
    renderAt(`/clientes/${CLIENT_ID}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Nova solicitação/ }));
    await user.type(screen.getByLabelText('O que foi solicitado'), 'Infiltração no quarto');
    await user.selectOptions(screen.getByLabelText('Imóvel'), 'p2');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByText('Solicitação adicionada.')).toBeInTheDocument();
    expect(created).toHaveBeenCalledWith({ method: 'POST', body: { descricao: 'Infiltração no quarto', status: 'em_analise', propertyId: 'p2' } });
  });

  it('mostra a mensagem da API quando a informação é repetida', async () => {
    stubApi(rafael, {
      [`POST ${API.propertyAttributes('p1')}`]: () => {
        throw new ApiRequestError(400, 'validation', 'Já existe uma informação com esse nome. Edite a existente.');
      },
    });
    renderAt(`/clientes/${CLIENT_ID}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Dados da residência' }));
    await user.click(await screen.findByRole('button', { name: /Adicionar informação/ }));
    await user.type(screen.getByLabelText('Informação'), 'Área construída');
    await user.type(screen.getByLabelText('Valor'), '200 m²');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByText('Já existe uma informação com esse nome. Edite a existente.')).toBeInTheDocument();
  });

  it('cliente vê o próprio painel sem botões de edição', async () => {
    stubApi(ana);
    renderAt('/cliente');
    expect(await screen.findByRole('heading', { name: 'Olá, Ana.' })).toBeInTheDocument();
    expect(screen.getByText(/Seu engenheiro responsável é Rafael Lima/)).toBeInTheDocument();
    expect(await screen.findByText('Diagnóstico inicial — Sobrado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nova solicitação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo imóvel/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Dados da residência' }));
    expect(await screen.findByText('180 m²')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });
});
