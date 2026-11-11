import { API, type Appointment, type AppointmentInput, type AppointmentUpdateInput, type EngineerAppointment } from '@fixable/shared';
import { apiFetch } from '../../api.ts';

export const agendaKeys = {
  client: (clientId: string, mes: string, propertyId: string) => ['appointments', clientId, mes, propertyId] as const,
  engineer: (mes: string) => ['appointments', 'engineer', mes] as const,
  all: ['appointments'] as const,
};

/** Agendamentos de um imóvel do cliente no mês (AAAA-MM). */
export function fetchClientAppointments(clientId: string, mes: string, propertyId: string): Promise<Appointment[]> {
  const query = new URLSearchParams({ mes, propertyId });
  return apiFetch<Appointment[]>(`${API.clientAppointments(clientId)}?${query.toString()}`);
}

/** Agendamentos de todos os clientes do engenheiro no mês (AAAA-MM). */
export function fetchEngineerAppointments(mes: string): Promise<EngineerAppointment[]> {
  return apiFetch<EngineerAppointment[]>(`${API.appointments}?${new URLSearchParams({ mes }).toString()}`);
}

/** Cria um agendamento para o cliente. */
export function createAppointment(clientId: string, input: AppointmentInput): Promise<Appointment> {
  return apiFetch<Appointment>(API.clientAppointments(clientId), { method: 'POST', body: input });
}

/** Altera um agendamento (dados ou status). */
export function updateAppointment(id: string, input: AppointmentUpdateInput): Promise<Appointment> {
  return apiFetch<Appointment>(API.appointment(id), { method: 'PATCH', body: input });
}

/** Exclui um agendamento. */
export function deleteAppointment(id: string): Promise<void> {
  return apiFetch<void>(API.appointment(id), { method: 'DELETE' });
}
