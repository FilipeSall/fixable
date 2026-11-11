import { describe, expect, it } from 'vitest';
import { SERVICE_REQUEST_STATUS_LABELS } from './catalog.ts';
import {
  APPOINTMENT_STATUS_LABELS,
  MAQUETE_COLUMNS,
  SERVICE_STATUS_LABELS,
  appointmentInput,
  clientDetail,
  idParams,
  propertyAttributeInput,
  propertyAttributeParams,
  roomInput,
  serviceInput,
  serviceRequestInput,
  teamInviteInput,
} from './platform.ts';
import { API } from './routes.ts';

const id = '3f2b8c1e-5a47-4d6e-9b1a-0c7d2e4f6a81';
const room = { floorId: id, nome: 'Sala', largura: 2, altura: 1 };
const service = { roomId: id, titulo: 'Trocar telhas', status: 'execucao', percentual: 40 };

describe('platform', () => {
  it('expõe os rótulos do modelo', () => {
    expect(MAQUETE_COLUMNS).toBe(6);
    expect(SERVICE_STATUS_LABELS).toEqual({
      prioridade: 'Prioridade',
      atencao: 'Precisa de atenção',
      execucao: 'Em execução',
      concluido: 'Concluído',
    });
    expect(APPOINTMENT_STATUS_LABELS).toEqual({
      confirmado: 'Confirmado',
      pendente: 'Pendente · requer confirmação',
      adiado: 'Adiado',
    });
    expect(SERVICE_REQUEST_STATUS_LABELS.em_analise).toBe('Em análise');
  });

  it('roomInput recusa largura 5 e x 6', () => {
    expect(roomInput.safeParse({ ...room, x: 5, y: 0 }).success).toBe(true);
    expect(roomInput.safeParse({ ...room, largura: 5 }).success).toBe(false);
    expect(roomInput.safeParse({ ...room, x: 6 }).success).toBe(false);
    expect(roomInput.safeParse({ ...room, altura: 3 }).success).toBe(false);
    expect(roomInput.safeParse({ ...room, y: -1 }).success).toBe(false);
  });

  it('serviceInput recusa percentual 101 e prazo fora do formato', () => {
    expect(serviceInput.safeParse({ ...service, prazo: '2026-12-31' }).success).toBe(true);
    expect(serviceInput.safeParse({ ...service, percentual: 101 }).success).toBe(false);
    expect(serviceInput.safeParse({ ...service, prazo: '31/12/2026' }).success).toBe(false);
  });

  it('appointmentInput vazio devolve as 3 mensagens fixas', () => {
    const resultado = appointmentInput.safeParse({});
    const mensagens = resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
    expect(mensagens).toContain('Informe o serviço.');
    expect(mensagens).toContain('Informe uma data válida.');
    expect(mensagens).toContain('Informe o horário.');
  });

  it('serviceRequestInput e propertyAttributeInput usam as mensagens fixas', () => {
    const solicitacao = serviceRequestInput.safeParse({ descricao: 'ab', status: 'em_analise' });
    expect(solicitacao.success ? [] : solicitacao.error.issues.map((issue) => issue.message)).toContain(
      'Descreva o que foi solicitado.',
    );
    const atributo = propertyAttributeInput.safeParse({ chave: '', valor: '' });
    expect(atributo.success ? [] : atributo.error.issues.map((issue) => issue.message)).toContain(
      'Preencha a informação e o valor.',
    );
  });

  it('teamInviteInput aceita só engenheiro e admin', () => {
    const convite = { nome: 'Ana Souza', email: 'ana@ex.com' };
    expect(teamInviteInput.safeParse({ ...convite, role: 'admin' }).success).toBe(true);
    expect(teamInviteInput.safeParse({ ...convite, role: 'cliente' }).success).toBe(false);
  });

  it('clientDetail valida a resposta com imóveis', () => {
    const detalhe = {
      id,
      nome: 'Ana',
      email: 'ana@ex.com',
      telefone: '11900000000',
      engenheiro: null,
      properties: [{ id, apelido: 'Casa', tipo: 'sobrado', cidade: 'Santo André' }],
    };
    expect(clientDetail.safeParse(detalhe).success).toBe(true);
  });

  it('rotas parametrizadas montam os caminhos', () => {
    expect(API.clients).toBe('/api/clients');
    expect(API.clientProperties('x')).toBe('/api/clients/x/properties');
    expect(API.floorplan('p')).toBe('/api/properties/p/floorplan');
    expect(API.serviceComplete('s')).toBe('/api/services/s/complete');
    expect(API.adminApplicationApprove('a')).toBe('/api/admin/applications/a/approve');
    expect(API.meClient).toBe('/api/me/client');
    expect(API.propertyAttribute('p', 'a')).toBe('/api/properties/p/attributes/a');
  });

  it('idParams e propertyAttributeParams exigem identificadores válidos', () => {
    expect(idParams.safeParse({ id }).success).toBe(true);
    expect(idParams.safeParse({ id: 'abc' }).success).toBe(false);
    expect(propertyAttributeParams.safeParse({ id, attrId: id }).success).toBe(true);
    expect(propertyAttributeParams.safeParse({ id, attrId: 'x' }).success).toBe(false);
  });
});
