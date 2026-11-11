import { PROPERTY_TYPE_LABELS, type ClientListItem } from '@fixable/shared';
import { Link } from 'react-router';
import { Avatar } from '../../../shared/components/Avatar.tsx';
import { Pill } from '../../../shared/components/Pill.tsx';

/** Descreve tipo de imóvel e cidade do cliente no cartão, quando existirem. */
function placeOf(client: ClientListItem): string {
  const tipo = client.tipoImovel ? PROPERTY_TYPE_LABELS[client.tipoImovel] : null;
  return [tipo, client.cidade].filter(Boolean).join(' · ') || 'Sem imóvel cadastrado';
}

/** Pluraliza um contador simples ("1 serviço ativo", "2 serviços ativos"). */
function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Cartão do cliente na lista do engenheiro, com selo de novo e contadores. */
export function ClientCard({ client }: Readonly<{ client: ClientListItem }>) {
  return (
    <Link to={`/clientes/${client.id}`} className="client-card" aria-label={`Abrir a página de ${client.nome}`}>
      <span className="top">
        <Avatar nome={client.nome} />
        <span>
          <strong>{client.nome}</strong>
          <small>{placeOf(client)}</small>
        </span>
      </span>
      <span className="meta">
        {client.novo ? <Pill color="clay">Novo cliente</Pill> : null}
        {client.servicosAtivos > 0 ? (
          <Pill color="blue">{plural(client.servicosAtivos, 'serviço ativo', 'serviços ativos')}</Pill>
        ) : (
          <Pill color="neutral">Sem serviços ativos</Pill>
        )}
        {client.solicitacoesAbertas > 0 ? (
          <Pill color="yellow">{plural(client.solicitacoesAbertas, 'solicitação aberta', 'solicitações abertas')}</Pill>
        ) : null}
      </span>
    </Link>
  );
}
