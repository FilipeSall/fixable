import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type {
  PropertyAttribute,
  PropertyAttributeInput,
  PropertyInput,
  PropertySummary,
  PropertyType,
} from '@fixable/shared';
import { floors, properties, propertyAttributes, rooms } from '../models/index.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type { Retangulo } from '../types/floorplan.types.ts';
import type { Viewer } from '../types/platform.types.ts';
import { AppError } from '../utils/app-error.ts';
import { notFound, requireClientAccess, requirePropertyAccess } from './access-policy.service.ts';
import { firstFreeSpot, floorplanFor } from './floorplan.service.ts';

const DUPLICATE_ATTRIBUTE_MESSAGE = 'Já existe uma informação com esse nome. Edite a existente.';

const attributeColumns = { id: propertyAttributes.id, chave: propertyAttributes.chave, valor: propertyAttributes.valor };

/** Grava os andares e os cômodos da planta padrão do tipo de imóvel, cada cômodo no primeiro espaço livre. */
export async function insertDefaultFloorplan(tx: Tx, propertyId: string, tipo: PropertyType): Promise<void> {
  for (const [posicao, andar] of floorplanFor(tipo).entries()) {
    const [floor] = await tx
      .insert(floors)
      .values({ propertyId, nome: andar.nome, posicao })
      .returning({ id: floors.id });
    const ocupados: Retangulo[] = [];
    const values = andar.comodos.map((comodo, ordem) => {
      const spot = firstFreeSpot(ocupados, comodo.largura, comodo.altura);
      ocupados.push({ ...spot, largura: comodo.largura, altura: comodo.altura });
      return { floorId: floor!.id, ...comodo, ...spot, posicao: ordem };
    });
    await tx.insert(rooms).values(values);
  }
}

/** Cria um imóvel para o cliente com a planta padrão do tipo, exigindo permissão de escrita no cliente. */
export async function createProperty(
  db: Db,
  viewer: Viewer,
  clientId: string,
  input: PropertyInput,
): Promise<PropertySummary> {
  await requireClientAccess(db, viewer, clientId, 'write');
  return db.transaction(async (tx) => {
    const [property] = await tx
      .insert(properties)
      .values({ clientId, apelido: input.apelido, tipo: input.tipo, cidade: input.cidade })
      .returning({ id: properties.id, apelido: properties.apelido, tipo: properties.tipo, cidade: properties.cidade });
    await insertDefaultFloorplan(tx, property!.id, input.tipo);
    return property!;
  });
}

/** Lista os dados da residência do imóvel na ordem em que foram cadastrados. */
export async function listAttributes(db: Db, viewer: Viewer, propertyId: string): Promise<PropertyAttribute[]> {
  await requirePropertyAccess(db, viewer, propertyId, 'read');
  return db
    .select(attributeColumns)
    .from(propertyAttributes)
    .where(eq(propertyAttributes.propertyId, propertyId))
    .orderBy(asc(propertyAttributes.posicao), asc(propertyAttributes.createdAt));
}

/** Bloqueia o imóvel até o fim da transação, para que checagem de chave e posição não corram em paralelo. */
async function lockProperty(tx: Tx, propertyId: string): Promise<void> {
  await tx.select({ id: properties.id }).from(properties).where(eq(properties.id, propertyId)).for('update');
}

/** Recusa com 400 quando o imóvel já tem outra informação com a mesma chave, sem diferenciar maiúsculas. */
async function assertUniqueKey(tx: Tx, propertyId: string, chave: string, exceptId?: string): Promise<void> {
  const conditions = [
    eq(propertyAttributes.propertyId, propertyId),
    sql`lower(${propertyAttributes.chave}) = lower(${chave})`,
  ];
  if (exceptId) conditions.push(ne(propertyAttributes.id, exceptId));
  const [existing] = await tx
    .select({ id: propertyAttributes.id })
    .from(propertyAttributes)
    .where(and(...conditions))
    .limit(1);
  if (existing) throw new AppError(400, 'validation', DUPLICATE_ATTRIBUTE_MESSAGE);
}

/** Adiciona uma informação no fim dos dados da residência, recusando chave repetida. */
export async function addAttribute(
  db: Db,
  viewer: Viewer,
  propertyId: string,
  input: PropertyAttributeInput,
): Promise<PropertyAttribute> {
  await requirePropertyAccess(db, viewer, propertyId, 'write');
  return db.transaction(async (tx) => {
    await lockProperty(tx, propertyId);
    await assertUniqueKey(tx, propertyId, input.chave);
    const [next] = await tx
      .select({ posicao: sql<number>`coalesce(max(${propertyAttributes.posicao}) + 1, 0)::int` })
      .from(propertyAttributes)
      .where(eq(propertyAttributes.propertyId, propertyId));
    const [created] = await tx
      .insert(propertyAttributes)
      .values({ propertyId, chave: input.chave, valor: input.valor, posicao: next!.posicao })
      .returning(attributeColumns);
    return created!;
  });
}

/** Edita a chave e o valor de uma informação do imóvel, recusando chave que já pertence a outra informação. */
export async function updateAttribute(
  db: Db,
  viewer: Viewer,
  propertyId: string,
  attrId: string,
  input: PropertyAttributeInput,
): Promise<PropertyAttribute> {
  await requirePropertyAccess(db, viewer, propertyId, 'write');
  return db.transaction(async (tx) => {
    await lockProperty(tx, propertyId);
    const ofProperty = and(eq(propertyAttributes.id, attrId), eq(propertyAttributes.propertyId, propertyId));
    const [current] = await tx.select({ id: propertyAttributes.id }).from(propertyAttributes).where(ofProperty);
    if (!current) throw notFound();
    await assertUniqueKey(tx, propertyId, input.chave, attrId);
    const [updated] = await tx
      .update(propertyAttributes)
      .set({ chave: input.chave, valor: input.valor })
      .where(ofProperty)
      .returning(attributeColumns);
    return updated!;
  });
}

/** Remove uma informação dos dados da residência, respondendo 404 quando ela não é daquele imóvel. */
export async function deleteAttribute(db: Db, viewer: Viewer, propertyId: string, attrId: string): Promise<void> {
  await requirePropertyAccess(db, viewer, propertyId, 'write');
  const removed = await db
    .delete(propertyAttributes)
    .where(and(eq(propertyAttributes.id, attrId), eq(propertyAttributes.propertyId, propertyId)))
    .returning({ id: propertyAttributes.id });
  if (removed.length === 0) throw notFound();
}
