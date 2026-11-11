import { and, asc, desc, eq, gt, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { HistoryItem, Service, ServiceInput, ServiceUpdateInput } from '@fixable/shared';
import { floors, rooms, services } from '../models/index.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type { Clock, ConclusionState, HistoryRow, ServiceRow } from '../types/maquete.types.ts';
import type { Queryable, Viewer } from '../types/platform.types.ts';
import { AppError } from '../utils/app-error.ts';
import { notFound, requirePropertyAccess } from './access-policy.service.ts';

const VISIBLE_AFTER_CONCLUSION_MS = 24 * 60 * 60 * 1000;
const INVALID_ROOM_MESSAGE = 'Selecione um cômodo deste imóvel.';

const serviceColumns = {
  id: services.id,
  roomId: services.roomId,
  titulo: services.titulo,
  descricao: services.descricao,
  status: services.status,
  prazo: services.prazo,
  percentual: services.percentual,
  concludedAt: services.concludedAt,
};

/** Converte a linha do banco no formato da API, com a data de conclusão em ISO. */
const toService = (row: ServiceRow): Service => ({ ...row, concludedAt: row.concludedAt?.toISOString() ?? null });

/** Converte a linha do histórico no formato da API, com a data de conclusão em ISO. */
const toHistoryItem = (row: HistoryRow): HistoryItem => ({ ...row, concludedAt: row.concludedAt.toISOString() });

/** Calcula conclusão e percentual: concluir grava a data uma vez e fixa 100%; reabrir limpa a data e zera o progresso não informado. */
export function conclusionFields(
  next: { status: ServiceRow['status']; percentual?: number },
  current: ConclusionState | null,
  now: Date,
): { concludedAt: Date | null; percentual: number } {
  const estavaConcluido = current?.status === 'concluido';
  if (next.status === 'concluido') {
    return { concludedAt: (estavaConcluido ? current.concludedAt : null) ?? now, percentual: 100 };
  }
  const anterior = estavaConcluido ? 0 : (current?.percentual ?? 0);
  return { concludedAt: null, percentual: next.percentual ?? anterior };
}

/** Lista os serviços em andamento com cômodo: os não concluídos e os concluídos há menos de 24 h. */
export async function listVisibleServices(q: Queryable, propertyId: string, now: Date): Promise<Service[]> {
  const limite = new Date(now.getTime() - VISIBLE_AFTER_CONCLUSION_MS);
  const rows = await q
    .select(serviceColumns)
    .from(services)
    .where(
      and(
        eq(services.propertyId, propertyId),
        isNotNull(services.roomId),
        or(ne(services.status, 'concluido'), gt(services.concludedAt, limite)),
      ),
    )
    .orderBy(asc(services.createdAt), asc(services.id));
  return rows.map(toService);
}

/** Cria o erro 400 de cômodo que não é do imóvel ou que já foi removido. */
const invalidRoom = (): AppError => new AppError(400, 'validation', INVALID_ROOM_MESSAGE);

/** Trava o cômodo contra exclusão até o fim da transação e recusa com 400 quando ele não é do imóvel. */
async function assertRoomOfProperty(tx: Tx, propertyId: string, roomId: string): Promise<void> {
  const [found] = await tx
    .select({ id: rooms.id })
    .from(rooms)
    .innerJoin(floors, eq(floors.id, rooms.floorId))
    .where(and(eq(rooms.id, roomId), eq(floors.propertyId, propertyId)))
    .for('key share', { of: rooms });
  if (!found) throw invalidRoom();
}

/** Confere a escrita no imóvel do serviço e o carrega travado, travando antes o cômodo atual contra exclusão. */
async function lockServiceForWrite(tx: Tx, viewer: Viewer, serviceId: string) {
  const [owner] = await tx
    .select({ propertyId: services.propertyId, roomId: services.roomId })
    .from(services)
    .where(eq(services.id, serviceId));
  if (!owner) throw notFound();
  await requirePropertyAccess(tx, viewer, owner.propertyId, 'write');
  if (owner.roomId) await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, owner.roomId)).for('key share');
  const [current] = await tx
    .select({ ...serviceColumns, propertyId: services.propertyId })
    .from(services)
    .where(eq(services.id, serviceId))
    .for('update');
  if (!current) throw notFound();
  return current;
}

/** Registra um serviço num cômodo do imóvel; criar já concluído grava a conclusão. */
export async function createService(
  db: Db,
  clock: Clock,
  viewer: Viewer,
  propertyId: string,
  input: ServiceInput,
): Promise<Service> {
  return db.transaction(async (tx) => {
    await requirePropertyAccess(tx, viewer, propertyId, 'write');
    await assertRoomOfProperty(tx, propertyId, input.roomId);
    const [created] = await tx
      .insert(services)
      .values({
        propertyId,
        roomId: input.roomId,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        status: input.status,
        prazo: input.prazo ?? null,
        ...conclusionFields(input, null, clock()),
      })
      .returning(serviceColumns);
    return toService(created!);
  });
}

/** Edita só os campos enviados; null ou texto vazio limpam descrição e prazo, e o status controla a conclusão. */
export async function updateService(
  db: Db,
  clock: Clock,
  viewer: Viewer,
  serviceId: string,
  input: ServiceUpdateInput,
): Promise<Service> {
  return db.transaction(async (tx) => {
    const current = await lockServiceForWrite(tx, viewer, serviceId);
    if (input.roomId !== undefined) await assertRoomOfProperty(tx, current.propertyId, input.roomId);
    const status = input.status ?? current.status;
    if (status !== 'concluido' && (input.roomId ?? current.roomId) === null) throw invalidRoom();
    const [updated] = await tx
      .update(services)
      .set({
        roomId: input.roomId,
        titulo: input.titulo,
        descricao: input.descricao,
        prazo: input.prazo,
        status,
        ...conclusionFields({ status, percentual: input.percentual }, current, clock()),
      })
      .where(eq(services.id, serviceId))
      .returning(serviceColumns);
    return toService(updated!);
  });
}

/** Conclui o serviço com 100%; repetir a chamada mantém a data da primeira conclusão. */
export async function completeService(db: Db, clock: Clock, viewer: Viewer, serviceId: string): Promise<Service> {
  return db.transaction(async (tx) => {
    const current = await lockServiceForWrite(tx, viewer, serviceId);
    if (current.status === 'concluido') return toService(current);
    const [updated] = await tx
      .update(services)
      .set({ status: 'concluido', concludedAt: clock(), percentual: 100 })
      .where(eq(services.id, serviceId))
      .returning(serviceColumns);
    return toService(updated!);
  });
}

/** Lista o histórico de manutenção do imóvel, do mais recente ao mais antigo; andar e cômodo removidos vêm como null. */
export async function listHistory(db: Db, viewer: Viewer, propertyId: string): Promise<HistoryItem[]> {
  await requirePropertyAccess(db, viewer, propertyId, 'read');
  const rows = await db
    .select({
      id: services.id,
      titulo: services.titulo,
      descricao: services.descricao,
      andar: floors.nome,
      comodo: rooms.nome,
      concludedAt: sql<Date>`${services.concludedAt}`.mapWith(services.concludedAt),
    })
    .from(services)
    .leftJoin(rooms, eq(rooms.id, services.roomId))
    .leftJoin(floors, eq(floors.id, rooms.floorId))
    .where(
      and(eq(services.propertyId, propertyId), eq(services.status, 'concluido'), isNotNull(services.concludedAt)),
    )
    .orderBy(desc(services.concludedAt), asc(services.id));
  return rows.map(toHistoryItem);
}
