import { MAQUETE_COLUMNS, type Floor, type Room, type Service, type ServiceStatus } from '@fixable/shared';
import type { RoomPlacement } from '../../../../types/maquete.types.ts';
import type { PillColor } from '../../../../types/platform-ui.types.ts';

export const STATUS_PILL: Record<ServiceStatus, PillColor> = {
  prioridade: 'red',
  atencao: 'yellow',
  execucao: 'blue',
  concluido: 'green',
};

const STATUS_ORDER: Record<ServiceStatus, number> = { prioridade: 0, atencao: 1, execucao: 2, concluido: 3 };
const HOUR_MS = 60 * 60 * 1000;
const VISIBLE_AFTER_CONCLUSION_HOURS = 24;
const MIN_ROWS = 3;

/** Posição do cômodo na grade de 6 colunas, em valores de CSS grid. */
export function placementOf(room: Room): RoomPlacement {
  return {
    gridColumn: `${room.x + 1} / span ${Math.min(room.largura, MAQUETE_COLUMNS)}`,
    gridRow: `${room.y + 1} / span ${room.altura}`,
  };
}

/** Número de linhas da planta: o suficiente para os cômodos, no mínimo 3, e uma a mais na edição. */
export function rowCountOf(floor: Floor, editable: boolean): number {
  const used = floor.rooms.reduce((max, room) => Math.max(max, room.y + room.altura), 0);
  return Math.max(MIN_ROWS, used) + (editable ? 1 : 0);
}

/** Serviços de um cômodo. */
export function servicesOfRoom(services: readonly Service[], roomId: string): Service[] {
  return services.filter((service) => service.roomId === roomId);
}

/** Serviços dos cômodos de um andar. */
export function servicesOfFloor(services: readonly Service[], floor: Floor): Service[] {
  const ids = new Set(floor.rooms.map((room) => room.id));
  return services.filter((service) => service.roomId !== null && ids.has(service.roomId));
}

/** Ordena como no modelo: ativos primeiro, depois prioridade, atenção, execução e concluído. */
export function sortServices(services: readonly Service[]): Service[] {
  return [...services].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/** Conta os serviços ainda não concluídos. */
export function activeCount(services: readonly Service[]): number {
  return services.filter((service) => service.status !== 'concluido').length;
}

/** Horas (arredondadas para cima, mínimo 1) até o serviço concluído sair da lista. */
export function hoursLeft(concludedAt: string, now: number): number {
  const elapsed = (now - new Date(concludedAt).getTime()) / HOUR_MS;
  return Math.max(1, Math.ceil(VISIBLE_AFTER_CONCLUSION_HOURS - elapsed));
}

/** Pluraliza "N serviço(s)". */
export function serviceCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'serviço' : 'serviços'}`;
}

/** Descreve onde o serviço está ("Andar 1 · Cozinha"). */
export function locationOf(floors: readonly Floor[], roomId: string | null): string {
  for (const floor of floors) {
    const room = floor.rooms.find((item) => item.id === roomId);
    if (room) return `${floor.nome} · ${room.nome}`;
  }
  return 'Cômodo removido';
}
