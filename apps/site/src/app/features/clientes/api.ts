import {
  API,
  type ClientDetail,
  type ClientListResponse,
  type PropertyAttribute,
  type PropertyAttributeInput,
  type PropertyInput,
  type PropertySummary,
  type ServiceRequest,
  type ServiceRequestInput,
} from '@fixable/shared';
import { apiFetch } from '../../api.ts';

export const clientKeys = {
  list: ['clients'] as const,
  detail: (id: string) => ['client', id] as const,
  me: ['me-client'] as const,
  attributes: (propertyId: string) => ['attributes', propertyId] as const,
  requests: (clientId: string) => ['requests', clientId] as const,
};

/** Busca a lista de clientes visíveis ao usuário, com os números de resumo. */
export function fetchClients(): Promise<ClientListResponse> {
  return apiFetch<ClientListResponse>(API.clients);
}

/** Busca os dados de um cliente e a lista dos imóveis dele. */
export function fetchClient(id: string): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(API.client(id));
}

/** Descobre o id de cliente do usuário logado (perfil cliente). */
export function fetchMeClient(): Promise<{ clientId: string }> {
  return apiFetch<{ clientId: string }>(API.meClient);
}

/** Cria um imóvel para o cliente, já com a planta padrão do tipo. */
export function createProperty(clientId: string, input: PropertyInput): Promise<PropertySummary> {
  return apiFetch<PropertySummary>(API.clientProperties(clientId), { method: 'POST', body: input });
}

/** Lista os dados cadastrados (chave e valor) de um imóvel. */
export function fetchAttributes(propertyId: string): Promise<PropertyAttribute[]> {
  return apiFetch<PropertyAttribute[]>(API.propertyAttributes(propertyId));
}

/** Adiciona uma informação aos dados do imóvel. */
export function createAttribute(propertyId: string, input: PropertyAttributeInput): Promise<PropertyAttribute> {
  return apiFetch<PropertyAttribute>(API.propertyAttributes(propertyId), { method: 'POST', body: input });
}

/** Altera uma informação dos dados do imóvel. */
export function updateAttribute(propertyId: string, attrId: string, input: PropertyAttributeInput): Promise<PropertyAttribute> {
  return apiFetch<PropertyAttribute>(API.propertyAttribute(propertyId, attrId), { method: 'PATCH', body: input });
}

/** Remove uma informação dos dados do imóvel. */
export function deleteAttribute(propertyId: string, attrId: string): Promise<void> {
  return apiFetch<void>(API.propertyAttribute(propertyId, attrId), { method: 'DELETE' });
}

/** Lista as solicitações do cliente, mais recentes primeiro. */
export function fetchRequests(clientId: string): Promise<ServiceRequest[]> {
  return apiFetch<ServiceRequest[]>(API.clientRequests(clientId));
}

/** Registra uma solicitação do cliente. */
export function createRequest(clientId: string, input: ServiceRequestInput): Promise<ServiceRequest> {
  return apiFetch<ServiceRequest>(API.clientRequests(clientId), { method: 'POST', body: input });
}

/** Altera uma solicitação existente. */
export function updateRequest(id: string, input: ServiceRequestInput): Promise<ServiceRequest> {
  return apiFetch<ServiceRequest>(API.request(id), { method: 'PATCH', body: input });
}

/** Exclui uma solicitação. */
export function deleteRequest(id: string): Promise<void> {
  return apiFetch<void>(API.request(id), { method: 'DELETE' });
}
