import { and, desc, eq } from 'drizzle-orm';
import type { ServiceRequest, ServiceRequestInput, ServiceRequestUpdateInput } from '@fixable/shared';
import { properties, serviceRequests } from '../models/index.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type { Queryable, Viewer } from '../types/platform.types.ts';
import type { ServiceRequestRow } from '../types/service-request.types.ts';
import { AppError } from '../utils/app-error.ts';
import { notFound, requireClientAccess } from './access-policy.service.ts';

const INVALID_PROPERTY_MESSAGE = 'Selecione um imóvel deste cliente.';

const requestColumns = {
  id: serviceRequests.id,
  descricao: serviceRequests.descricao,
  status: serviceRequests.status,
  propertyId: serviceRequests.propertyId,
  propertyApelido: properties.apelido,
  createdAt: serviceRequests.createdAt,
};

/** Converte a linha do banco no formato da API, com a data de criação em ISO. */
const toServiceRequest = (row: ServiceRequestRow): ServiceRequest => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** Trava o imóvel contra exclusão até o fim da transação e recusa com 400 quando ele não é do cliente. */
export async function assertPropertyOfClient(tx: Tx, clientId: string, propertyId: string): Promise<void> {
  const [found] = await tx
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.clientId, clientId)))
    .for('key share');
  if (!found) throw new AppError(400, 'validation', INVALID_PROPERTY_MESSAGE);
}

/** Busca a solicitação com o apelido do imóvel, já no formato da API. */
async function findRequest(q: Queryable, requestId: string): Promise<ServiceRequest> {
  const [row] = await q
    .select(requestColumns)
    .from(serviceRequests)
    .leftJoin(properties, eq(properties.id, serviceRequests.propertyId))
    .where(eq(serviceRequests.id, requestId));
  if (!row) throw notFound();
  return toServiceRequest(row);
}

/** Confere a escrita no cliente dono da solicitação e trava a linha até o fim da transação. */
async function lockRequestForWrite(tx: Tx, viewer: Viewer, requestId: string): Promise<{ clientId: string }> {
  const [owner] = await tx
    .select({ clientId: serviceRequests.clientId })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId));
  if (!owner) throw notFound();
  await requireClientAccess(tx, viewer, owner.clientId, 'write');
  const [locked] = await tx
    .select({ clientId: serviceRequests.clientId })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId))
    .for('update');
  if (!locked) throw notFound();
  return locked;
}

/** Lista as solicitações do cliente, da mais recente à mais antiga, com o apelido do imóvel. */
export async function listRequests(db: Db, viewer: Viewer, clientId: string): Promise<ServiceRequest[]> {
  await requireClientAccess(db, viewer, clientId, 'read');
  const rows = await db
    .select(requestColumns)
    .from(serviceRequests)
    .leftJoin(properties, eq(properties.id, serviceRequests.propertyId))
    .where(eq(serviceRequests.clientId, clientId))
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id));
  return rows.map(toServiceRequest);
}

/** Registra uma solicitação do cliente; o imóvel, se vier, precisa ser dele. */
export async function createRequest(
  db: Db,
  viewer: Viewer,
  clientId: string,
  input: ServiceRequestInput,
): Promise<ServiceRequest> {
  return db.transaction(async (tx) => {
    await requireClientAccess(tx, viewer, clientId, 'write');
    if (input.propertyId) await assertPropertyOfClient(tx, clientId, input.propertyId);
    const [created] = await tx
      .insert(serviceRequests)
      .values({ clientId, descricao: input.descricao, status: input.status, propertyId: input.propertyId ?? null })
      .returning({ id: serviceRequests.id });
    return findRequest(tx, created!.id);
  });
}

/** Edita só os campos enviados; null no imóvel desvincula a solicitação dele. */
export async function updateRequest(
  db: Db,
  viewer: Viewer,
  requestId: string,
  input: ServiceRequestUpdateInput,
): Promise<ServiceRequest> {
  return db.transaction(async (tx) => {
    const { clientId } = await lockRequestForWrite(tx, viewer, requestId);
    if (input.propertyId) await assertPropertyOfClient(tx, clientId, input.propertyId);
    const changes = { descricao: input.descricao, status: input.status, propertyId: input.propertyId };
    if (Object.values(changes).some((value) => value !== undefined)) {
      await tx.update(serviceRequests).set(changes).where(eq(serviceRequests.id, requestId));
    }
    return findRequest(tx, requestId);
  });
}

/** Exclui a solicitação depois de conferir a escrita no cliente dono. */
export async function deleteRequest(db: Db, viewer: Viewer, requestId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockRequestForWrite(tx, viewer, requestId);
    await tx.delete(serviceRequests).where(eq(serviceRequests.id, requestId));
  });
}
