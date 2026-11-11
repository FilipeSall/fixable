import { SERVICE_REQUEST_STATUS_LABELS, type ServiceRequest, type ServiceRequestStatus } from '@fixable/shared';
import { useState } from 'react';
import type { ClientTabProps } from '../../../../types/clientes.types.ts';
import type { PillColor } from '../../../../types/platform-ui.types.ts';
import { AddBox } from '../../../shared/components/AddBox.tsx';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { Pill } from '../../../shared/components/Pill.tsx';
import { RowCard } from '../../../shared/components/RowCard.tsx';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { formatDateTime } from '../../../shared/lib/format.ts';
import { useRequests } from '../hooks/useClientes.ts';
import { RequestModal } from './RequestModal.tsx';

const STATUS_COLORS: Record<ServiceRequestStatus, PillColor> = {
  em_analise: 'yellow',
  agendado: 'clay',
  em_execucao: 'blue',
  concluido: 'green',
};

/** Monta o subtítulo da solicitação com a data e, se houver, o imóvel. */
function subtitleOf(request: ServiceRequest): string {
  const quando = `Solicitado em ${formatDateTime(request.createdAt)}`;
  return request.propertyApelido ? `${quando} · ${request.propertyApelido}` : quando;
}

/** Aba de solicitações do cliente; o engenheiro adiciona e edita, o cliente só acompanha. */
export function SolicitacoesTab({ clientId, properties, editable }: Readonly<ClientTabProps>) {
  const { data, error, isPending } = useRequests(clientId);
  const [editing, setEditing] = useState<ServiceRequest | null | 'new'>(null);

  return (
    <>
      {editable ? <AddBox label="Nova solicitação" onClick={() => setEditing('new')} /> : null}
      {isPending ? <p role="status">Carregando...</p> : null}
      {error ? <p role="alert">{errorMessage(error)}</p> : null}
      {data?.length === 0 ? <EmptyState>Nenhuma solicitação registrada.</EmptyState> : null}
      <div className="rows">
        {data?.map((request) => (
          <RowCard
            key={request.id}
            title={request.descricao}
            subtitle={subtitleOf(request)}
            right={<Pill color={STATUS_COLORS[request.status]}>{SERVICE_REQUEST_STATUS_LABELS[request.status]}</Pill>}
            onClick={editable ? () => setEditing(request) : undefined}
          />
        ))}
      </div>
      {editing ? (
        <RequestModal
          clientId={clientId}
          properties={properties}
          request={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
