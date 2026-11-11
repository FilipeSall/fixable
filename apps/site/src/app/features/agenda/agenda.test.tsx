import { API, type Appointment, type ClientDetail, type Me } from '@fixable/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { ToastProvider } from '../../shared/components/Toast.tsx';
import { ana, mockedFetch, renderApp } from '../auth/test-utils.tsx';
import { ClientePage } from '../clientes/pages/ClientePage.tsx';
import { MeuPainelPage } from '../clientes/pages/MeuPainelPage.tsx';
import { dayStatus, monthCells, shiftMonth } from './lib/calendar.ts';
import { CalendarioPage } from './pages/CalendarioPage.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const rafael: Me = { ...ana, nome: 'Rafael Lima', role: 'engenheiro' };
const detail: ClientDetail = {
  id: 'c1',
  nome: 'Ana Souza',
  email: 'ana@fixable.com',
  telefone: null,
  engenheiro: { nome: 'Rafael Lima' },
  properties: [{ id: 'p1', apelido: 'Sobrado · Santo André', tipo: 'sobrado', cidade: 'Santo André' }],
};

const base: Appointment = {
  id: 'ag1',
  propertyId: 'p1',
  propertyApelido: 'Sobrado · Santo André',
  servico: 'Visita técnica',
  data: '2026-11-12',
  hora: '09:00',
  status: 'confirmado',
  descricao: 'Avaliar a infiltração',
};
const appointments: Appointment[] = [base, { ...base, id: 'ag2', servico: 'Revisão elétrica', hora: '14:00', status: 'adiado' }];

type Init = { method?: string; body?: unknown } | undefined;

function stubApi(me: Me, overrides: Record<string, (init: Init) => unknown> = {}) {
  mockedFetch.mockImplementation((path: string, init?: Init) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = overrides[key];
    if (handler) return Promise.resolve(handler(init));
    if (key.startsWith(`GET ${API.clientAppointments('c1')}?`)) return Promise.resolve(appointments);
    if (key.startsWith('GET /api/appointments?')) return Promise.resolve(appointments.map((item) => ({ ...item, clientId: 'c1', clientNome: 'Ana Souza' })));
    const routes: Record<string, unknown> = {
      [`GET ${API.me}`]: me,
      [`GET ${API.meClient}`]: { clientId: 'c1' },
      [`GET ${API.client('c1')}`]: detail,
      [`GET ${API.clientRequests('c1')}`]: [],
    };
    if (key in routes) return Promise.resolve(routes[key]);
    return Promise.reject(new ApiRequestError(404, 'not_found', 'Recurso não encontrado.'));
  });
}

async function openAgenda(route: string, viaTab = true) {
  renderApp(
    <ToastProvider>
      <Routes>
        <Route path="/clientes/:clientId" element={<ClientePage />} />
        <Route path="/cliente" element={<MeuPainelPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
      </Routes>
    </ToastProvider>,
    route,
  );
  const user = userEvent.setup();
  if (viaTab) await user.click(await screen.findByRole('tab', { name: 'Agendamentos' }));
  return user;
}

describe('calendário (funções)', () => {
  it('novembro de 2026 começa num domingo e fevereiro de 2027 tem 28 dias', () => {
    expect(monthCells('2026-11')[0]).toBe('2026-11-01');
    const fev = monthCells('2027-02');
    expect(fev.filter(Boolean)).toHaveLength(28);
    expect(fev.slice(0, 1)).toEqual([null]);
  });

  it('dia com adiado fica vermelho; pendente vence confirmado', () => {
    expect(dayStatus([{ ...base, status: 'confirmado' }, { ...base, status: 'adiado' }])).toBe('adiado');
    expect(dayStatus([{ ...base, status: 'confirmado' }, { ...base, status: 'pendente' }])).toBe('pendente');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('agendamentos', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra o mês atual, a cor do dia e a lista ordenada', async () => {
    stubApi(rafael);
    await openAgenda('/clientes/c1');
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument();
    const dia = await screen.findByRole('button', { name: 'Dia 12: 2 serviços, Adiado' });
    expect(dia).toHaveClass('ev-adiado');
    expect(screen.getByRole('heading', { name: 'Agendamentos de novembro' })).toBeInTheDocument();
    const titles = screen.getAllByText(/Visita técnica|Revisão elétrica/, { selector: 'strong' }).map((node) => node.textContent);
    expect(titles).toEqual(['Visita técnica', 'Revisão elétrica']);
  });

  it('navega para o próximo mês', async () => {
    stubApi(rafael);
    const user = await openAgenda('/clientes/c1');
    await user.click(await screen.findByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByRole('heading', { name: 'Dezembro de 2026' })).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith(`${API.clientAppointments('c1')}?mes=2026-12&propertyId=p1`);
  });

  it('engenheiro cria um agendamento e muda o status com os avisos', async () => {
    const created = vi.fn(() => base);
    const patched = vi.fn(() => ({ ...base, status: 'pendente' }));
    stubApi(rafael, { [`POST ${API.clientAppointments('c1')}`]: created, [`PATCH ${API.appointment('ag1')}`]: patched });
    const user = await openAgenda('/clientes/c1');
    await user.click(await screen.findByRole('button', { name: /Novo agendamento/ }));
    await user.type(screen.getByLabelText('Serviço agendado'), 'Troca de registro');
    await user.click(screen.getByRole('button', { name: 'Agendar' }));
    expect(await screen.findByText('Agendamento salvo. Ele já aparece no calendário do cliente.')).toBeInTheDocument();
    expect(created).toHaveBeenCalledWith({
      method: 'POST',
      body: { propertyId: 'p1', servico: 'Troca de registro', data: '2026-11-13', hora: '09:00', status: 'pendente' },
    });
    await user.click(screen.getAllByRole('button', { name: 'Ver detalhes do serviço' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Marcar pendente' }));
    expect(await screen.findByText('Agendamento marcado como “pendente”.')).toBeInTheDocument();
    expect(patched).toHaveBeenCalledWith({ method: 'PATCH', body: { status: 'pendente' } });
  });

  it('cliente vê o calendário sem ações de edição', async () => {
    stubApi(ana);
    const user = await openAgenda('/cliente');
    await user.click(await screen.findByRole('button', { name: 'Dia 12: 2 serviços, Adiado' }));
    expect(screen.getByText('Avaliar a infiltração')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo agendamento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  });

  it('calendário do engenheiro mostra o nome do cliente', async () => {
    stubApi(rafael);
    await openAgenda('/calendario', false);
    expect(await screen.findByRole('heading', { name: 'Calendário' })).toBeInTheDocument();
    expect((await screen.findAllByText('Ana Souza')).length).toBeGreaterThan(0);
    expect(mockedFetch).toHaveBeenCalledWith('/api/appointments?mes=2026-11');
  });
});
