import { useQuery } from '@tanstack/react-query';
import { agendaKeys, fetchClientAppointments, fetchEngineerAppointments } from '../api.ts';

/** Agendamentos de um imóvel do cliente no mês. */
export function useClientAppointments(clientId: string, mes: string, propertyId: string) {
  return useQuery({
    queryKey: agendaKeys.client(clientId, mes, propertyId),
    queryFn: () => fetchClientAppointments(clientId, mes, propertyId),
  });
}

/** Agendamentos de todos os clientes do engenheiro no mês. */
export function useEngineerAppointments(mes: string) {
  return useQuery({ queryKey: agendaKeys.engineer(mes), queryFn: () => fetchEngineerAppointments(mes) });
}
