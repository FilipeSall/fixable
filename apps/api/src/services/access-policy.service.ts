import { eq } from 'drizzle-orm';
import { clients, properties } from '../models/index.ts';
import type {
  AccessMode,
  ClientScope,
  PropertyScope,
  Queryable,
  Viewer,
} from '../types/platform.types.ts';
import { AppError, NOT_FOUND_MESSAGE } from '../utils/app-error.ts';

/** Cria o erro 404 usado sempre que o recurso não existe ou o usuário não pode acessá-lo. */
export const notFound = (): AppError => new AppError(404, 'not_found', NOT_FOUND_MESSAGE);

/** Diz se o usuário enxerga o cliente: admin vê todos, engenheiro só os dele e cliente só o próprio cadastro. */
function canRead(viewer: Viewer, client: { userId: string; engineerId: string | null }): boolean {
  if (viewer.role === 'admin') return true;
  if (viewer.role === 'engenheiro') return client.engineerId === viewer.id;
  if (viewer.role === 'cliente') return client.userId === viewer.id;
  return false;
}

/** Carrega o escopo do cliente quando o usuário pode vê-lo, ou devolve null se não existe ou não é dele. */
export async function loadClientScope(db: Queryable, viewer: Viewer, clientId: string): Promise<ClientScope | null> {
  const [client] = await db
    .select({ clientId: clients.id, userId: clients.userId, engineerId: clients.engineerId })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!client || !canRead(viewer, client)) return null;
  return { clientId: client.clientId, engineerId: client.engineerId };
}

/** Exige acesso ao cliente no modo pedido e lança 404 quando negado; só engenheiro dono e admin escrevem. */
export async function requireClientAccess(
  db: Queryable,
  viewer: Viewer,
  clientId: string,
  mode: AccessMode,
): Promise<ClientScope> {
  const scope = await loadClientScope(db, viewer, clientId);
  if (!scope || (mode === 'write' && viewer.role === 'cliente')) throw notFound();
  return scope;
}

/** Resolve o cliente dono do imóvel e reaplica a regra de acesso ao cliente, lançando 404 quando negado. */
export async function requirePropertyAccess(
  db: Queryable,
  viewer: Viewer,
  propertyId: string,
  mode: AccessMode,
): Promise<PropertyScope> {
  const [property] = await db
    .select({ clientId: properties.clientId })
    .from(properties)
    .where(eq(properties.id, propertyId));
  if (!property) throw notFound();
  const scope = await requireClientAccess(db, viewer, property.clientId, mode);
  return { ...scope, propertyId };
}
