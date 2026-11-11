import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { MAQUETE_COLUMNS } from '@fixable/shared';
import { appointments, clients, floors, properties, rooms, services, users } from '../../src/models/index.ts';
import { overlaps } from '../../src/services/floorplan.service.ts';
import { onboardClient } from '../../src/services/client-onboarding.service.ts';
import { resetDb, testApp, type TestApp } from '../helpers.ts';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await testApp();
});

beforeEach(async () => {
  await resetDb(ctx.db);
});

afterAll(async () => {
  await ctx.close();
});

async function seedRoom() {
  const [user] = await ctx.db.insert(users).values({ role: 'cliente', nome: 'Ana', email: 'ana@fixable.com' }).returning();
  const [client] = await ctx.db.insert(clients).values({ userId: user!.id }).returning();
  const [property] = await ctx.db
    .insert(properties)
    .values({ clientId: client!.id, tipo: 'sobrado', cidade: 'Recife', apelido: 'Casa' })
    .returning();
  const [floor] = await ctx.db.insert(floors).values({ propertyId: property!.id, nome: 'Andar 1', posicao: 0 }).returning();
  const [room] = await ctx.db
    .insert(rooms)
    .values({ floorId: floor!.id, nome: 'Sala', largura: 3, altura: 2, posicao: 0 })
    .returning();
  return { client: client!, property: property!, room: room! };
}

describe('schema da plataforma', () => {
  it('cômodo novo nasce em x=0 e y=0', async () => {
    const { room } = await seedRoom();
    expect([room.x, room.y]).toEqual([0, 0]);
  });

  it('cômodo rejeita dimensões e posições fora da grade', async () => {
    const { room } = await seedRoom();
    const base = { floorId: room.floorId, nome: 'Closet', largura: 1, altura: 1, posicao: 1, x: 0, y: 3 };
    await expect(ctx.db.insert(rooms).values(base)).resolves.toBeDefined();
    for (const invalido of [
      { largura: 5 },
      { largura: 0 },
      { altura: 3 },
      { altura: 0 },
      { x: -1 },
      { x: 6 },
      { y: -1 },
      { x: 4, largura: 3 },
    ]) {
      await expect(ctx.db.insert(rooms).values({ ...base, ...invalido })).rejects.toThrow();
    }
  });

  it('serviço nasce com percentual 0 e rejeita percentual fora de 0-100', async () => {
    const { property, room } = await seedRoom();
    const base = { roomId: room.id, propertyId: property.id, titulo: 'Infiltração', status: 'atencao' as const };
    const [service] = await ctx.db.insert(services).values(base).returning();
    expect(service!.percentual).toBe(0);
    await expect(ctx.db.insert(services).values({ ...base, percentual: 101 })).rejects.toThrow();
    await expect(ctx.db.insert(services).values({ ...base, percentual: -1 })).rejects.toThrow();
  });

  it('remover o cômodo mantém seus serviços sem cômodo, para o histórico', async () => {
    const { property, room } = await seedRoom();
    await ctx.db.insert(services).values({ roomId: room.id, propertyId: property.id, titulo: 'Pintura', status: 'concluido' });
    await ctx.db.delete(rooms).where(eq(rooms.id, room.id));
    const restantes = await ctx.db.select().from(services);
    expect(restantes.map((service) => service.roomId)).toEqual([null]);
  });

  it('agendamento nasce pendente e some com o cliente', async () => {
    const { client, property } = await seedRoom();
    const [appointment] = await ctx.db
      .insert(appointments)
      .values({ clientId: client.id, propertyId: property.id, servico: 'Vistoria', data: '2026-12-01', hora: '09:30' })
      .returning();
    expect(appointment!.status).toBe('pendente');
    await ctx.db.delete(clients).where(eq(clients.id, client.id));
    expect(await ctx.db.select().from(appointments)).toHaveLength(0);
  });

  it('o onboarding grava posições sem sobreposição dentro da grade', async () => {
    await ctx.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ role: 'cliente', nome: 'Bia', email: 'bia@fixable.com' }).returning();
      await onboardClient(
        tx,
        ctx.config,
        user!.id,
        {
          nome: 'Bia',
          email: 'bia@fixable.com',
          telefone: '81999999999',
          cidade: 'Recife',
          tipoImovel: 'sobrado',
          preferenciaContato: 'whatsapp',
        } as never,
      );
    });
    const all = await ctx.db.select().from(rooms);
    expect(all).toHaveLength(10);
    for (const room of all) {
      expect(room.x + room.largura).toBeLessThanOrEqual(MAQUETE_COLUMNS);
      for (const other of all) {
        if (other.id !== room.id && other.floorId === room.floorId) expect(overlaps(room, other)).toBe(false);
      }
    }
    expect(all.some((room) => room.x > 0 || room.y > 0)).toBe(true);
  });
});
