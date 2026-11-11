import {
  API,
  type Floor,
  type FloorInput,
  type Floorplan,
  type HistoryItem,
  type Room,
  type RoomFieldsInput,
  type Service,
  type ServiceInput,
  type ServiceUpdateInput,
} from '@fixable/shared';
import { apiFetch } from '../../api.ts';

export const maqueteKeys = {
  floorplan: (propertyId: string) => ['floorplan', propertyId] as const,
  history: (propertyId: string) => ['history', propertyId] as const,
};

/** Busca andares, cômodos e serviços visíveis do imóvel. */
export function fetchFloorplan(propertyId: string): Promise<Floorplan> {
  return apiFetch<Floorplan>(API.floorplan(propertyId));
}

/** Busca o histórico de manutenção do imóvel. */
export function fetchHistory(propertyId: string): Promise<HistoryItem[]> {
  return apiFetch<HistoryItem[]>(API.propertyHistory(propertyId));
}

/** Cria um andar novo (o nome padrão é dado pela API). */
export function createFloor(propertyId: string): Promise<Floor> {
  return apiFetch<Floor>(API.floors(propertyId), { method: 'POST', body: {} });
}

/** Renomeia um andar. */
export function updateFloor(id: string, input: FloorInput): Promise<Floor> {
  return apiFetch<Floor>(API.floor(id), { method: 'PATCH', body: input });
}

/** Exclui um andar. */
export function deleteFloor(id: string): Promise<void> {
  return apiFetch<void>(API.floor(id), { method: 'DELETE' });
}

/** Cria um cômodo no andar; sem posição, a API usa o primeiro espaço livre. */
export function createRoom(floorId: string, input: RoomFieldsInput): Promise<Room> {
  return apiFetch<Room>(API.rooms(floorId), { method: 'POST', body: input });
}

/** Altera nome, tamanho ou posição de um cômodo. */
export function updateRoom(id: string, input: RoomFieldsInput): Promise<Room> {
  return apiFetch<Room>(API.room(id), { method: 'PATCH', body: input });
}

/** Exclui um cômodo. */
export function deleteRoom(id: string): Promise<void> {
  return apiFetch<void>(API.room(id), { method: 'DELETE' });
}

/** Cria um serviço num cômodo do imóvel. */
export function createService(propertyId: string, input: ServiceInput): Promise<Service> {
  return apiFetch<Service>(API.propertyServices(propertyId), { method: 'POST', body: input });
}

/** Altera um serviço. */
export function updateService(id: string, input: ServiceUpdateInput): Promise<Service> {
  return apiFetch<Service>(API.service(id), { method: 'PATCH', body: input });
}

/** Marca o serviço como concluído. */
export function completeService(id: string): Promise<Service> {
  return apiFetch<Service>(API.serviceComplete(id), { method: 'POST' });
}
