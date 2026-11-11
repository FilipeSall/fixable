import { and, asc, eq, gte, lt } from 'drizzle-orm';
import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentInput,
  type AppointmentsQuery,
  type AppointmentUpdateInput,
} from '@fixable/shared';
import { appointments, clients, properties, users } from '../models/index.ts';
import type { AppointmentDeps, AppointmentRow } from '../types/appointment.types.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type { AgendamentoData } from '../types/mail.types.ts';
import type { Queryable, Viewer } from '../types/platform.types.ts';
import { notFound, requireClientAccess } from './access-policy.service.ts';
import { enqueueEmail } from './outbox.service.ts';
import { assertPropertyOfClient } from './service-request.service.ts';

const CLIENT_HOME_PATH = '/app/cliente';

const appointmentColumns = {
  id: appointments.id,
  clientId: appointments.clientId,
  propertyId: appointments.propertyId,
  propertyApelido: properties.apelido,
  servico: appointments.servico,
  data: appointments.data,
  hora: appointments.hora,
  status: appointments.status,
  descricao: appointments.descricao,
};

/** Converte a linha do banco no formato da API, com a hora em HH:MM e sem o id do cliente. */
const toAppointment = (row: AppointmentRow): Appointment => ({
  id: row.id,
  propertyId: row.propertyId,
  propertyApelido: row.propertyApelido,
  servico: row.servico,
  data: row.data,
  hora: row.hora.slice(0, 5),
  status: row.status,
  descricao: row.descricao,
});

/** Converte a data YYYY-MM-DD para o formato dd/mm/aaaa usado nos e-mails. */
const formatDate = (data: string): string => data.split('-').reverse().join('/');

/** Calcula o primeiro dia do mês informado e o primeiro dia do mês seguinte, no formato YYYY-MM-DD. */
function monthRange(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  const proximo = numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`;
  return { inicio: `${mes}-01`, fim: `${proximo}-01` };
}

/** Busca o agendamento com o apelido do imóvel, ou lança 404 quando ele não existe. */
async function findAppointment(q: Queryable, appointmentId: string): Promise<AppointmentRow> {
  const [row] = await q
    .select(appointmentColumns)
    .from(appointments)
    .innerJoin(properties, eq(properties.id, appointments.propertyId))
    .where(eq(appointments.id, appointmentId));
  if (!row) throw notFound();
  return row;
}

/** Confere a escrita no cliente dono do agendamento e trava a linha até o fim da transação. */
async function lockAppointmentForWrite(tx: Tx, viewer: Viewer, appointmentId: string): Promise<{ clientId: string }> {
  const [owner] = await tx
    .select({ clientId: appointments.clientId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  if (!owner) throw notFound();
  await requireClientAccess(tx, viewer, owner.clientId, 'write');
  const [locked] = await tx
    .select({ clientId: appointments.clientId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .for('update');
  if (!locked) throw notFound();
  return locked;
}

/** Enfileira, na transação corrente, o aviso ao cliente de que o agendamento foi criado ou atualizado. */
async function notifyClient(
  tx: Tx,
  config: AppointmentDeps['config'],
  row: AppointmentRow,
  acao: AgendamentoData['acao'],
): Promise<void> {
  const [cliente] = await tx
    .select({ nome: users.nome, email: users.email })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.userId))
    .where(eq(clients.id, row.clientId));
  if (!cliente) throw notFound();
  await enqueueEmail(tx, {
    to: cliente.email,
    template: 'agendamento',
    data: {
      nome: cliente.nome,
      acao,
      servico: row.servico,
      imovel: row.propertyApelido,
      data: formatDate(row.data),
      hora: row.hora.slice(0, 5),
      status: APPOINTMENT_STATUS_LABELS[row.status],
      link: new URL(CLIENT_HOME_PATH, config.APP_ORIGIN).toString(),
    },
  });
}

/** Lista os agendamentos do cliente no mês, por data e hora, opcionalmente só de um imóvel. */
export async function listAppointments(
  db: Db,
  viewer: Viewer,
  clientId: string,
  query: AppointmentsQuery,
): Promise<Appointment[]> {
  await requireClientAccess(db, viewer, clientId, 'read');
  const { inicio, fim } = monthRange(query.mes);
  const rows = await db
    .select(appointmentColumns)
    .from(appointments)
    .innerJoin(properties, eq(properties.id, appointments.propertyId))
    .where(
      and(
        eq(appointments.clientId, clientId),
        gte(appointments.data, inicio),
        lt(appointments.data, fim),
        query.propertyId ? eq(appointments.propertyId, query.propertyId) : undefined,
      ),
    )
    .orderBy(asc(appointments.data), asc(appointments.hora), asc(appointments.id));
  return rows.map(toAppointment);
}

/** Cria o agendamento num imóvel do cliente e avisa o cliente por e-mail na mesma transação. */
export async function createAppointment(
  { db, config }: AppointmentDeps,
  viewer: Viewer,
  clientId: string,
  input: AppointmentInput,
): Promise<Appointment> {
  return db.transaction(async (tx) => {
    await requireClientAccess(tx, viewer, clientId, 'write');
    await assertPropertyOfClient(tx, clientId, input.propertyId);
    const [created] = await tx
      .insert(appointments)
      .values({ ...input, clientId, descricao: input.descricao ?? null })
      .returning({ id: appointments.id });
    const row = await findAppointment(tx, created!.id);
    await notifyClient(tx, config, row, 'criado');
    return toAppointment(row);
  });
}

/** Edita só os campos enviados, inclusive o status, e avisa o cliente por e-mail na mesma transação. */
export async function updateAppointment(
  { db, config }: AppointmentDeps,
  viewer: Viewer,
  appointmentId: string,
  input: AppointmentUpdateInput,
): Promise<Appointment> {
  return db.transaction(async (tx) => {
    const { clientId } = await lockAppointmentForWrite(tx, viewer, appointmentId);
    if (input.propertyId) await assertPropertyOfClient(tx, clientId, input.propertyId);
    await tx.update(appointments).set(input).where(eq(appointments.id, appointmentId));
    const row = await findAppointment(tx, appointmentId);
    await notifyClient(tx, config, row, 'atualizado');
    return toAppointment(row);
  });
}

/** Exclui o agendamento depois de conferir a escrita no cliente dono; excluir não envia e-mail. */
export async function deleteAppointment(db: Db, viewer: Viewer, appointmentId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockAppointmentForWrite(tx, viewer, appointmentId);
    await tx.delete(appointments).where(eq(appointments.id, appointmentId));
  });
}
