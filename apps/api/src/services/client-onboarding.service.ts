import { PROPERTY_TYPE_LABELS, CONTACT_PREFERENCE_LABELS, planName, type DiagnosticInput } from '@fixable/shared';
import { clients, properties, propertyAttributes, serviceRequests, users } from '../models/index.ts';
import type { Tx } from '../types/db.types.ts';
import type { LeadAssignment, PublicConfig } from '../types/public.types.ts';
import { pickEngineer } from './assignment.service.ts';
import { sendInvite } from './invite.service.ts';
import { insertDefaultFloorplan } from './property.service.ts';

const REQUEST_SUMMARY_LIMIT = 120;
const REQUEST_PREFIX = { inicial: 'Diagnóstico inicial', adicional: 'Diagnóstico adicional' } as const;

/** Monta a descrição da solicitação de diagnóstico com tipo, plano e o início da descrição do problema. */
export function requestDescription(kind: keyof typeof REQUEST_PREFIX, input: DiagnosticInput): string {
  const plano = input.plano ? ` · ${planName(input.plano)}` : '';
  const resumo = input.descricao ? `: ${[...input.descricao].slice(0, REQUEST_SUMMARY_LIMIT).join('')}` : '';
  return `${REQUEST_PREFIX[kind]} — ${PROPERTY_TYPE_LABELS[input.tipoImovel]}${plano}${resumo}`;
}

/** Lista os atributos do imóvel na ordem do modelo, incluindo descrição e plano só quando informados. */
function attributesFor(input: DiagnosticInput): [chave: string, valor: string][] {
  const rows: [string, string][] = [
    ['Tipo de imóvel', PROPERTY_TYPE_LABELS[input.tipoImovel]],
    ['Cidade', input.cidade],
    ['Telefone', input.telefone],
    ['E-mail', input.email],
    ['Preferência de contato', CONTACT_PREFERENCE_LABELS[input.preferenciaContato]],
  ];
  if (input.descricao) rows.push(['Descrição do problema', input.descricao]);
  if (input.plano) rows.push(['Plano de interesse', planName(input.plano)]);
  return rows;
}

/** Cria o imóvel do primeiro diagnóstico com seus atributos e a maquete padrão, e devolve o id. */
async function insertProperty(tx: Tx, clientId: string, input: DiagnosticInput): Promise<string> {
  const [property] = await tx
    .insert(properties)
    .values({
      clientId,
      tipo: input.tipoImovel,
      cidade: input.cidade,
      apelido: `${PROPERTY_TYPE_LABELS[input.tipoImovel]} · ${input.cidade}`,
    })
    .returning({ id: properties.id });
  const propertyId = property!.id;
  await tx
    .insert(propertyAttributes)
    .values(attributesFor(input).map(([chave, valor], posicao) => ({ propertyId, chave, valor, posicao })));
  await insertDefaultFloorplan(tx, propertyId, input.tipoImovel);
  return propertyId;
}

/** Cria o usuário convidado do e-mail novo e devolve o id, ou null quando um envio concorrente já o criou. */
export async function insertInvitedClientUser(tx: Tx, input: DiagnosticInput): Promise<string | null> {
  const [user] = await tx
    .insert(users)
    .values({
      role: 'cliente',
      status: 'convidado',
      nome: input.nome,
      email: input.email,
      telefone: input.telefone,
      cidade: input.cidade,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  return user?.id ?? null;
}

/** Cadastra o cliente novo com engenheiro, imóvel, maquete e solicitação inicial, e envia o convite. */
export async function onboardClient(
  tx: Tx,
  config: PublicConfig,
  userId: string,
  input: DiagnosticInput,
): Promise<LeadAssignment> {
  const engineer = await pickEngineer(tx);
  const [client] = await tx
    .insert(clients)
    .values({ userId, engineerId: engineer?.id ?? null })
    .returning({ id: clients.id });
  const clientId = client!.id;
  const propertyId = await insertProperty(tx, clientId, input);
  await tx.insert(serviceRequests).values({ clientId, propertyId, descricao: requestDescription('inicial', input) });
  await sendInvite(tx, config, userId);
  return { clientId, engineer };
}
