import { API, type ClientDetail, type Floorplan, type HistoryItem, type Me, type PropertySummary } from '@fixable/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { ToastProvider } from '../../shared/components/Toast.tsx';
import { ana, mockedFetch, renderApp } from '../auth/test-utils.tsx';
import { ClientePage } from '../clientes/pages/ClientePage.tsx';
import { MeuPainelPage } from '../clientes/pages/MeuPainelPage.tsx';
import { hoursLeft, placementOf } from './lib/maquete.ts';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const rafael: Me = { ...ana, nome: 'Rafael Lima', role: 'engenheiro' };
const property: PropertySummary = { id: 'p1', apelido: 'Sobrado · Santo André', tipo: 'sobrado', cidade: 'Santo André' };
const detail: ClientDetail = { id: 'c1', nome: 'Ana Souza', email: 'ana@fixable.com', telefone: null, engenheiro: { nome: 'Rafael Lima' }, properties: [property] };

const plan: Floorplan = {
  floors: [
    {
      id: 'f1',
      nome: 'Andar 1',
      posicao: 0,
      rooms: [
        { id: 'r1', nome: 'Sala de estar', x: 0, y: 0, largura: 3, altura: 2 },
        { id: 'r2', nome: 'Cozinha', x: 3, y: 0, largura: 2, altura: 1 },
      ],
    },
    { id: 'f2', nome: 'Andar 2', posicao: 1, rooms: [{ id: 'r3', nome: 'Suíte', x: 0, y: 0, largura: 3, altura: 2 }] },
  ],
  services: [
    { id: 's1', roomId: 'r2', titulo: 'Trocar torneira', descricao: 'Vazamento na pia', status: 'prioridade', prazo: '2026-11-20', percentual: 30, concludedAt: null },
    { id: 's2', roomId: 'r2', titulo: 'Pintar parede', descricao: null, status: 'concluido', prazo: null, percentual: 100, concludedAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  ],
};

const history: HistoryItem[] = [
  { id: 's2', titulo: 'Pintar parede', descricao: 'Tinta acrílica', andar: 'Andar 1', comodo: 'Cozinha', concludedAt: '2026-11-08T15:30:00.000Z' },
  { id: 's9', titulo: 'Trocar tomada', descricao: null, andar: null, comodo: null, concludedAt: '2026-11-01T10:00:00.000Z' },
];

type Init = { method?: string; body?: unknown } | undefined;

function stubApi(me: Me, overrides: Record<string, (init: Init) => unknown> = {}) {
  mockedFetch.mockImplementation((path: string, init?: Init) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = overrides[key];
    if (handler) {
      try {
        return Promise.resolve(handler(init));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    const routes: Record<string, unknown> = {
      [`GET ${API.me}`]: me,
      [`GET ${API.meClient}`]: { clientId: 'c1' },
      [`GET ${API.client('c1')}`]: detail,
      [`GET ${API.clientRequests('c1')}`]: [],
      [`GET ${API.floorplan('p1')}`]: plan,
      [`GET ${API.propertyHistory('p1')}`]: history,
    };
    if (key in routes) return Promise.resolve(routes[key]);
    return Promise.reject(new ApiRequestError(404, 'not_found', 'Recurso não encontrado.'));
  });
}

async function openTab(route: string, tab: string) {
  renderApp(
    <ToastProvider>
      <Routes>
        <Route path="/clientes/:clientId" element={<ClientePage />} />
        <Route path="/cliente" element={<MeuPainelPage />} />
      </Routes>
    </ToastProvider>,
    route,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', { name: tab }));
  return user;
}

describe('maquete', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('posiciona os cômodos na grade e calcula as horas restantes', () => {
    expect(placementOf({ id: 'x', nome: 'Sala', x: 3, y: 1, largura: 2, altura: 1 })).toEqual({ gridColumn: '4 / span 2', gridRow: '2 / span 1' });
    expect(hoursLeft(new Date(0).toISOString(), 23 * 3600_000 + 1)).toBe(1);
    expect(hoursLeft(new Date(0).toISOString(), 2 * 3600_000)).toBe(22);
  });

  it('mostra os cômodos com os pontos de status e os serviços do andar', async () => {
    stubApi(rafael);
    await openTab('/clientes/c1', 'Serviços em andamento');
    const cozinha = await screen.findByRole('button', { name: /^Cozinha — 2 serviços/ });
    expect(cozinha).toHaveStyle({ gridColumn: '4 / span 2' });
    expect(cozinha.querySelector('.mq-dot.prioridade')).not.toBeNull();
    expect(cozinha.querySelector('.mq-dot.concluido')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Andar 1 · 1 serviço' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Serviços em Andar 1' })).toBeInTheDocument();
    expect(screen.getAllByText(/Sai desta lista em cerca de 22 h/).length).toBeGreaterThan(0);
  });

  it('engenheiro adiciona um cômodo e vê o aviso', async () => {
    const created = vi.fn(() => ({ id: 'r9', nome: 'Lavabo', x: 5, y: 0, largura: 1, altura: 1 }));
    stubApi(rafael, { [`POST ${API.rooms('f1')}`]: created });
    const user = await openTab('/clientes/c1', 'Serviços em andamento');
    await user.click(await screen.findByRole('button', { name: '+ Adicionar cômodo' }));
    await user.type(screen.getByLabelText('Nome do cômodo'), 'Lavabo');
    await user.selectOptions(screen.getByLabelText('Largura na maquete'), '1');
    await user.click(screen.getByRole('button', { name: 'Adicionar cômodo' }));
    expect(await screen.findByText('Cômodo adicionado à maquete.')).toBeInTheDocument();
    expect(created).toHaveBeenCalledWith({ method: 'POST', body: { nome: 'Lavabo', largura: 1, altura: 1 } });
  });

  it('mostra no modal a recusa de sobreposição vinda da API', async () => {
    const message = 'Essa posição ou tamanho encosta em outro cômodo. Escolha outro lugar na planta.';
    stubApi(rafael, {
      [`PATCH ${API.room('r2')}`]: () => {
        throw new ApiRequestError(400, 'validation', message);
      },
    });
    const user = await openTab('/clientes/c1', 'Serviços em andamento');
    await user.click(await screen.findByRole('button', { name: /^Cozinha — 2 serviços/ }));
    await user.click(screen.getByRole('button', { name: 'Editar cômodo' }));
    const coluna = screen.getByLabelText('Coluna na planta (1 a 6)');
    await user.clear(coluna);
    await user.type(coluna, '1');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('engenheiro cria e conclui serviços com os avisos do modelo', async () => {
    const created = vi.fn(() => plan.services[0]);
    const completed = vi.fn(() => ({ ...plan.services[0], status: 'concluido' }));
    stubApi(rafael, { [`POST ${API.propertyServices('p1')}`]: created, [`POST ${API.serviceComplete('s1')}`]: completed });
    const user = await openTab('/clientes/c1', 'Serviços em andamento');
    await user.click(await screen.findByRole('button', { name: /^Cozinha — 2 serviços/ }));
    await user.click(screen.getByRole('button', { name: '+ Adicionar serviço' }));
    await user.type(screen.getByLabelText('Tarefa'), 'Revisar disjuntor');
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));
    expect(await screen.findByText('Serviço salvo na maquete.')).toBeInTheDocument();
    expect(created).toHaveBeenCalledWith({ method: 'POST', body: { roomId: 'r2', titulo: 'Revisar disjuntor', status: 'atencao', percentual: 0 } });
    const pop = screen.getByRole('region', { name: 'Cômodo Cozinha' });
    await user.click(within(pop).getByRole('button', { name: 'Marcar como concluído' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Concluir serviço' })).getByRole('button', { name: 'Marcar como concluído' }));
    expect(await screen.findByText('Serviço concluído e enviado ao histórico de manutenção.')).toBeInTheDocument();
    expect(completed).toHaveBeenCalled();
  });

  it('histórico lista os concluídos, inclusive de cômodo removido, e expande a descrição', async () => {
    stubApi(rafael);
    const user = await openTab('/clientes/c1', 'Histórico de manutenção');
    expect(await screen.findByText(/Andar 1 · Cozinha · Concluído em/)).toBeInTheDocument();
    expect(screen.getByText(/Cômodo removido · Concluído em/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver detalhes de Pintar parede' }));
    expect(screen.getByText('Tinta acrílica')).toBeInTheDocument();
  });

  it('cliente vê a maquete sem botões de edição', async () => {
    stubApi(ana);
    const user = await openTab('/cliente', 'Serviços em andamento');
    await user.click(await screen.findByRole('button', { name: /^Cozinha — 2 serviços/ }));
    expect(screen.getByText(/Toque em um cômodo para ver o andamento/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Adicionar cômodo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Adicionar serviço' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como concluído' })).not.toBeInTheDocument();
  });

  it('engenheiro edita um serviço, limpando prazo e descrição', async () => {
    const patched = vi.fn(() => plan.services[0]);
    stubApi(rafael, { [`PATCH ${API.service('s1')}`]: patched });
    const user = await openTab('/clientes/c1', 'Serviços em andamento');
    await user.click(await screen.findByRole('button', { name: /^Cozinha — 2 serviços/ }));
    const pop = screen.getByRole('region', { name: 'Cômodo Cozinha' });
    await user.click(within(pop).getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Prazo'));
    await user.clear(screen.getByLabelText('Descrição da tarefa'));
    await user.selectOptions(screen.getByLabelText('Status e prioridade'), 'execucao');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Serviço salvo na maquete.')).toBeInTheDocument();
    expect(patched).toHaveBeenCalledWith({
      method: 'PATCH',
      body: { roomId: 'r2', titulo: 'Trocar torneira', status: 'execucao', percentual: 30, descricao: '', prazo: null },
    });
  });
});
