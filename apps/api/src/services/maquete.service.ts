import { and, asc, count, eq, inArray, ne, sql } from 'drizzle-orm';
import { MAQUETE_COLUMNS } from '@fixable/shared';
import type { Floor, FloorInput, Floorplan, NewFloorInput, Room, RoomFieldsInput } from '@fixable/shared';
import { floors, properties, rooms, services } from '../models/index.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type { Retangulo } from '../types/floorplan.types.ts';
import type { Clock } from '../types/maquete.types.ts';
import type { AccessMode, Queryable, Viewer } from '../types/platform.types.ts';
import { AppError } from '../utils/app-error.ts';
import { notFound, requirePropertyAccess } from './access-policy.service.ts';
import { firstFreeSpot, overlaps } from './floorplan.service.ts';
import { listVisibleServices } from './room-service.service.ts';

const COLLISION_MESSAGE =
  'Essa posição ou tamanho encosta em outro cômodo. Escolha outro lugar na planta.';
const FLOOR_ACTIVE_MESSAGE = 'Este andar tem serviços ativos. Conclua ou mova os serviços antes de excluir.';
const ROOM_ACTIVE_MESSAGE = 'Este cômodo tem serviços ativos. Conclua ou mova os serviços antes de excluir.';
const LAST_FLOOR_MESSAGE = 'O imóvel precisa ter pelo menos um andar.';
const PARTIAL_POSITION_MESSAGE = 'Informe a coluna e a linha do cômodo.';

const roomColumns = {
  id: rooms.id,
  nome: rooms.nome,
  x: rooms.x,
  y: rooms.y,
  largura: rooms.largura,
  altura: rooms.altura,
};

const floorColumns = { id: floors.id, nome: floors.nome, posicao: floors.posicao };

/** Cria o erro 400 de validação com a mensagem dada. */
const invalid = (message: string): AppError => new AppError(400, 'validation', message);

/** Separa o cômodo do andar a que pertence, deixando só os campos da API. */
const toRoom = ({ id, nome, x, y, largura, altura }: Room): Room => ({ id, nome, x, y, largura, altura });

/** Busca os cômodos dos andares informados, na ordem da planta. */
async function roomsOf(q: Queryable, floorIds: string[]): Promise<(Room & { floorId: string })[]> {
  if (floorIds.length === 0) return [];
  return q
    .select({ ...roomColumns, floorId: rooms.floorId })
    .from(rooms)
    .where(inArray(rooms.floorId, floorIds))
    .orderBy(asc(rooms.posicao), asc(rooms.createdAt));
}

/** Monta o andar com seus cômodos no formato da API. */
async function floorWithRooms(q: Queryable, floorId: string): Promise<Floor> {
  const [floor] = await q.select(floorColumns).from(floors).where(eq(floors.id, floorId));
  const floorRooms = await roomsOf(q, [floorId]);
  return { ...floor!, rooms: floorRooms.map(toRoom) };
}

/** Resolve o imóvel do andar e confere o acesso no modo pedido, com 404 quando não existe ou é negado. */
async function requireFloorAccess(q: Queryable, viewer: Viewer, floorId: string, mode: AccessMode) {
  const [floor] = await q.select({ propertyId: floors.propertyId }).from(floors).where(eq(floors.id, floorId));
  if (!floor) throw notFound();
  await requirePropertyAccess(q, viewer, floor.propertyId, mode);
  return floor.propertyId;
}

/** Resolve o andar e o imóvel do cômodo e confere a escrita, com 404 quando não existe ou é negado. */
async function requireRoomWrite(tx: Tx, viewer: Viewer, roomId: string) {
  const [room] = await tx
    .select({ ...roomColumns, floorId: rooms.floorId, propertyId: floors.propertyId })
    .from(rooms)
    .innerJoin(floors, eq(floors.id, rooms.floorId))
    .where(eq(rooms.id, roomId));
  if (!room) throw notFound();
  await requirePropertyAccess(tx, viewer, room.propertyId, 'write');
  return room;
}

/** Trava o imóvel até o fim da transação, para que contagem e posição dos andares não corram em paralelo. */
async function lockProperty(tx: Tx, propertyId: string): Promise<void> {
  await tx.select({ id: properties.id }).from(properties).where(eq(properties.id, propertyId)).for('no key update');
}

/** Trava o andar até o fim da transação, para que duas gravações não ocupem o mesmo espaço. */
async function lockFloor(tx: Tx, floorId: string): Promise<void> {
  await tx.select({ id: floors.id }).from(floors).where(eq(floors.id, floorId)).for('no key update');
}

/** Relê o cômodo travando a linha, depois do lock do andar, para partir da posição gravada por quem segurava o lock; 404 se sumiu. */
async function lockedRoom(tx: Tx, roomId: string): Promise<Room> {
  const [room] = await tx.select(roomColumns).from(rooms).where(eq(rooms.id, roomId)).for('update');
  if (!room) throw notFound();
  return room;
}

/** Recusa com 400 a posição que passa da sexta coluna ou se sobrepõe a algum dos outros cômodos do andar. */
function assertFits(alvo: Retangulo, outros: Retangulo[]): void {
  const foraDaGrade = alvo.x + alvo.largura > MAQUETE_COLUMNS;
  if (foraDaGrade || outros.some((outro) => overlaps(alvo, outro))) throw invalid(COLLISION_MESSAGE);
}

/** Busca os cômodos do andar, deixando de fora o cômodo informado. */
async function otherRooms(tx: Tx, floorId: string, exceptRoomId?: string): Promise<Retangulo[]> {
  const conditions = [eq(rooms.floorId, floorId)];
  if (exceptRoomId) conditions.push(ne(rooms.id, exceptRoomId));
  return tx.select(roomColumns).from(rooms).where(and(...conditions));
}

/** Conta os serviços não concluídos dos cômodos informados. */
async function activeServicesIn(tx: Tx, roomIds: string[]): Promise<number> {
  if (roomIds.length === 0) return 0;
  const [row] = await tx
    .select({ total: count() })
    .from(services)
    .where(and(inArray(services.roomId, roomIds), ne(services.status, 'concluido')));
  return row!.total;
}

/** Devolve a maquete do imóvel: andares com cômodos e os serviços visíveis em andamento. */
export async function getFloorplan(db: Db, clock: Clock, viewer: Viewer, propertyId: string): Promise<Floorplan> {
  await requirePropertyAccess(db, viewer, propertyId, 'read');
  const propertyFloors = await db
    .select(floorColumns)
    .from(floors)
    .where(eq(floors.propertyId, propertyId))
    .orderBy(asc(floors.posicao), asc(floors.createdAt));
  const allRooms = await roomsOf(db, propertyFloors.map((floor) => floor.id));
  return {
    floors: propertyFloors.map((floor) => ({
      ...floor,
      rooms: allRooms.filter((room) => room.floorId === floor.id).map(toRoom),
    })),
    services: await listVisibleServices(db, propertyId, clock()),
  };
}

/** Adiciona um andar vazio no fim do imóvel, com o nome "Andar {n+1}" quando nenhum nome é enviado. */
export async function createFloor(
  db: Db,
  viewer: Viewer,
  propertyId: string,
  input: NewFloorInput | null | undefined,
): Promise<Floor> {
  return db.transaction(async (tx) => {
    await requirePropertyAccess(tx, viewer, propertyId, 'write');
    await lockProperty(tx, propertyId);
    const [stats] = await tx
      .select({ total: count(), next: sql<number>`coalesce(max(${floors.posicao}) + 1, 0)::int` })
      .from(floors)
      .where(eq(floors.propertyId, propertyId));
    const [created] = await tx
      .insert(floors)
      .values({ propertyId, nome: input?.nome ?? `Andar ${stats!.total + 1}`, posicao: stats!.next })
      .returning(floorColumns);
    return { ...created!, rooms: [] };
  });
}

/** Renomeia o andar e devolve ele com seus cômodos. */
export async function renameFloor(db: Db, viewer: Viewer, floorId: string, input: FloorInput): Promise<Floor> {
  return db.transaction(async (tx) => {
    await requireFloorAccess(tx, viewer, floorId, 'write');
    await tx.update(floors).set({ nome: input.nome }).where(eq(floors.id, floorId));
    return floorWithRooms(tx, floorId);
  });
}

/** Exclui o andar e seus cômodos; recusa o único andar do imóvel e andar com serviço não concluído. */
export async function deleteFloor(db: Db, viewer: Viewer, floorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const propertyId = await requireFloorAccess(tx, viewer, floorId, 'write');
    await lockProperty(tx, propertyId);
    const [stats] = await tx.select({ total: count() }).from(floors).where(eq(floors.propertyId, propertyId));
    if (stats!.total <= 1) throw invalid(LAST_FLOOR_MESSAGE);
    const floorRooms = await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.floorId, floorId)).for('update');
    if ((await activeServicesIn(tx, floorRooms.map((room) => room.id))) > 0) throw invalid(FLOOR_ACTIVE_MESSAGE);
    await tx.delete(floors).where(eq(floors.id, floorId));
  });
}

/** Adiciona um cômodo ao andar na posição pedida ou, sem coluna e linha, no primeiro espaço livre; exige as duas ou nenhuma. */
export async function createRoom(db: Db, viewer: Viewer, floorId: string, input: RoomFieldsInput): Promise<Room> {
  return db.transaction(async (tx) => {
    await requireFloorAccess(tx, viewer, floorId, 'write');
    await lockFloor(tx, floorId);
    const { largura, altura } = input;
    if ((input.x === undefined) !== (input.y === undefined)) throw invalid(PARTIAL_POSITION_MESSAGE);
    const ocupados = await otherRooms(tx, floorId);
    const spot =
      input.x === undefined || input.y === undefined
        ? firstFreeSpot(ocupados, largura, altura)
        : { x: input.x, y: input.y };
    assertFits({ ...spot, largura, altura }, ocupados);
    const [next] = await tx
      .select({ posicao: sql<number>`coalesce(max(${rooms.posicao}) + 1, 0)::int` })
      .from(rooms)
      .where(eq(rooms.floorId, floorId));
    const [created] = await tx
      .insert(rooms)
      .values({ floorId, nome: input.nome, largura, altura, ...spot, posicao: next!.posicao })
      .returning(roomColumns);
    return created!;
  });
}

/** Edita nome, tamanho e posição do cômodo; sem coluna e linha mantém a posição atual. */
export async function updateRoom(db: Db, viewer: Viewer, roomId: string, input: RoomFieldsInput): Promise<Room> {
  return db.transaction(async (tx) => {
    const { floorId } = await requireRoomWrite(tx, viewer, roomId);
    await lockFloor(tx, floorId);
    const current = await lockedRoom(tx, roomId);
    const alvo = { x: input.x ?? current.x, y: input.y ?? current.y, largura: input.largura, altura: input.altura };
    assertFits(alvo, await otherRooms(tx, floorId, roomId));
    const [updated] = await tx
      .update(rooms)
      .set({ nome: input.nome, ...alvo })
      .where(eq(rooms.id, roomId))
      .returning(roomColumns);
    return updated!;
  });
}

/** Exclui o cômodo, recusando quando ele tem serviço não concluído. */
export async function deleteRoom(db: Db, viewer: Viewer, roomId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireRoomWrite(tx, viewer, roomId);
    await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).for('update');
    if ((await activeServicesIn(tx, [roomId])) > 0) throw invalid(ROOM_ACTIVE_MESSAGE);
    await tx.delete(rooms).where(eq(rooms.id, roomId));
  });
}
