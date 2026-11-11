import { API, type AdminApplication, type AdminLead, type Me } from '@fixable/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api.ts';
import { ToastProvider } from '../../shared/components/Toast.tsx';
import { ana, mockedFetch, renderApp } from '../auth/test-utils.tsx';
import { CandidaturasPage } from './pages/CandidaturasPage.tsx';
import { EquipePage } from './pages/EquipePage.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';

vi.mock('../../api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api.ts')>()),
  apiFetch: vi.fn(),
}));

const bia: Me = { ...ana, nome: 'Bia Admin', role: 'admin' };
const leads: AdminLead[] = [
  { id: 'l1', nome: 'Ana Souza', email: 'ana@x.com', telefone: '11900000000', cidade: 'Santo André', tipoImovel: 'sobrado', plano: '3m', engenheiro: { nome: 'Rafael Lima' }, createdAt: '2026-11-05T12:00:00.000Z' },
  { id: 'l2', nome: 'Carlos Mendes', email: 'carlos@x.com', telefone: '11911111111', cidade: 'Osasco', tipoImovel: 'apartamento', plano: null, engenheiro: null, createdAt: '2026-11-06T12:00:00.000Z' },
];
const pendentes: AdminApplication[] = [
  { id: 'a1', nome: 'Marcos Ribeiro', email: 'marcos@x.com', telefone: '11922222222', cidade: 'São Paulo', area: 'outro', status: 'pendente', createdAt: '2026-11-07T12:00:00.000Z' },
];

type Init = { method?: string; body?: unknown } | undefined;

function stubApi(overrides: Record<string, (init: Init) => unknown> = {}) {
  let approved = false;
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
    if (key === `POST ${API.adminApplicationApprove('a1')}`) {
      approved = true;
      return Promise.resolve({});
    }
    const routes: Record<string, unknown> = {
      [`GET ${API.me}`]: bia,
      [`GET ${API.adminLeads}?atribuicao=todos`]: leads,
      [`GET ${API.adminLeads}?atribuicao=sem`]: leads.filter((lead) => lead.engenheiro === null),
      [`GET ${API.adminApplications}?status=pendente`]: approved ? [] : pendentes,
      [`GET ${API.adminApplications}?status=aprovada`]: [],
    };
    if (key in routes) return Promise.resolve(routes[key]);
    return Promise.reject(new ApiRequestError(404, 'not_found', 'Recurso não encontrado.'));
  });
}

function renderAt(route: string) {
  renderApp(
    <ToastProvider>
      <Routes>
        <Route path="/admin/leads" element={<LeadsPage />} />
        <Route path="/admin/candidaturas" element={<CandidaturasPage />} />
        <Route path="/admin/equipe" element={<EquipePage />} />
      </Routes>
    </ToastProvider>,
    route,
  );
  return userEvent.setup();
}

describe('admin', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('leads mostram o engenheiro ou "Sem atribuição" e o filtro', async () => {
    stubApi();
    const user = renderAt('/admin/leads');
    expect(await screen.findByText('Rafael Lima')).toBeInTheDocument();
    expect(screen.getAllByText('Sem atribuição').length).toBeGreaterThan(0);
    expect(screen.getByText(/Santo André · Sobrado · Plano para 3 meses/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Sem atribuição' }));
    expect(await screen.findByText(/Carlos Mendes/)).toBeInTheDocument();
    expect(screen.queryByText(/Ana Souza ·/)).not.toBeInTheDocument();
  });

  it('aprovar pede confirmação, avisa e tira da lista de pendentes', async () => {
    stubApi();
    const user = renderAt('/admin/candidaturas');
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }));
    const dialog = screen.getByRole('dialog', { name: 'Aprovar candidatura' });
    await user.click(within(dialog).getByRole('button', { name: 'Aprovar' }));
    expect(await screen.findByText('Candidatura aprovada. Convite enviado para marcos@x.com.')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma candidatura neste status.')).toBeInTheDocument();
  });

  it('409 da API aparece no aviso', async () => {
    stubApi({
      [`POST ${API.adminApplicationRefuse('a1')}`]: () => {
        throw new ApiRequestError(409, 'conflict', 'Esta candidatura já foi analisada.');
      },
    });
    const user = renderAt('/admin/candidaturas');
    await user.click(await screen.findByRole('button', { name: 'Recusar' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Recusar candidatura' })).getByRole('button', { name: 'Recusar' }));
    expect(await screen.findByText('Esta candidatura já foi analisada.')).toBeInTheDocument();
  });

  it('convite envia nome, e-mail e perfil', async () => {
    const invited = vi.fn(() => ({}));
    stubApi({ [`POST ${API.adminInvites}`]: invited });
    const user = renderAt('/admin/equipe');
    await user.click(await screen.findByRole('button', { name: 'Convidar pessoa' }));
    await user.type(screen.getByLabelText('Nome completo'), 'Rafael Lima');
    await user.type(screen.getByLabelText('E-mail'), 'rafael@fixable.com');
    await user.selectOptions(screen.getByLabelText('Perfil'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByText('Convite enviado para rafael@fixable.com.')).toBeInTheDocument();
    expect(invited).toHaveBeenCalledWith({ method: 'POST', body: { nome: 'Rafael Lima', email: 'rafael@fixable.com', role: 'admin' } });
  });
});
