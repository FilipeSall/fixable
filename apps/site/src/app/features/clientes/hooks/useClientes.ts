import { useQuery } from '@tanstack/react-query';
import { clientKeys, fetchAttributes, fetchClient, fetchClients, fetchMeClient, fetchRequests } from '../api.ts';

/** Lista de clientes do engenheiro (ou de todos, para o admin) com o resumo. */
export function useClientList() {
  return useQuery({ queryKey: clientKeys.list, queryFn: fetchClients });
}

/** Dados de um cliente e dos imóveis dele. */
export function useClient(id: string) {
  return useQuery({ queryKey: clientKeys.detail(id), queryFn: () => fetchClient(id) });
}

/** Id de cliente do usuário logado. */
export function useMeClient() {
  return useQuery({ queryKey: clientKeys.me, queryFn: fetchMeClient });
}

/** Dados cadastrados do imóvel. */
export function useAttributes(propertyId: string) {
  return useQuery({ queryKey: clientKeys.attributes(propertyId), queryFn: () => fetchAttributes(propertyId) });
}

/** Solicitações do cliente. */
export function useRequests(clientId: string) {
  return useQuery({ queryKey: clientKeys.requests(clientId), queryFn: () => fetchRequests(clientId) });
}
