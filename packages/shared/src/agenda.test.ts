import { describe, expect, it } from 'vitest';
import { appointmentsQuery, appointmentUpdateInput, serviceRequestUpdateInput } from './agenda.ts';
import { engineerAppointment } from './platform.ts';
import { API } from './routes.ts';

const id = '3f2b8c1e-5a47-4d6e-9b1a-0c7d2e4f6a81';

describe('agenda', () => {
  it('a edição da solicitação aceita só o status e limpa o imóvel com null', () => {
    expect(serviceRequestUpdateInput.parse({ status: 'agendado' })).toEqual({ status: 'agendado' });
    expect(serviceRequestUpdateInput.parse({ propertyId: null })).toEqual({ propertyId: null });
    expect(serviceRequestUpdateInput.parse({ propertyId: id })).toEqual({ propertyId: id });
    expect(serviceRequestUpdateInput.safeParse({ descricao: 'ab' }).success).toBe(false);
  });

  it('a edição do agendamento aceita só o status e limpa a descrição', () => {
    expect(appointmentUpdateInput.parse({ status: 'confirmado' })).toEqual({ status: 'confirmado' });
    expect(appointmentUpdateInput.parse({ descricao: '  ' })).toEqual({ descricao: null });
    expect(appointmentUpdateInput.parse({ descricao: null })).toEqual({ descricao: null });
    expect(appointmentUpdateInput.safeParse({ hora: '25:00' }).success).toBe(false);
  });

  it('a consulta do mês exige YYYY-MM e aceita filtrar por imóvel', () => {
    expect(appointmentsQuery.parse({ mes: '2026-11' })).toEqual({ mes: '2026-11' });
    expect(appointmentsQuery.parse({ mes: '2026-11', propertyId: id })).toEqual({ mes: '2026-11', propertyId: id });
    expect(appointmentsQuery.safeParse({ mes: '2026-13' }).success).toBe(false);
    expect(appointmentsQuery.safeParse({}).success).toBe(false);
  });

  it('o agendamento do calendário do engenheiro traz o cliente', () => {
    const item = {
      id,
      propertyId: id,
      propertyApelido: 'Casa',
      servico: 'Revisão',
      data: '2026-11-20',
      hora: '09:30',
      status: 'pendente',
      descricao: null,
    };
    expect(engineerAppointment.safeParse(item).success).toBe(false);
    expect(engineerAppointment.parse({ ...item, clientId: id, clientNome: 'Marina' })).toMatchObject({
      clientNome: 'Marina',
    });
    expect(API.appointments).toBe('/api/appointments');
  });
});
