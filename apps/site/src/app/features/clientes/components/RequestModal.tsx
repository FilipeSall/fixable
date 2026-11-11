import { SERVICE_REQUEST_STATUSES, SERVICE_REQUEST_STATUS_LABELS, type ServiceRequestStatus } from '@fixable/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { RequestModalProps } from '../../../../types/clientes.types.ts';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { clientKeys, createRequest, deleteRequest, updateRequest } from '../api.ts';

/** Modal de criar, editar e excluir uma solicitação do cliente. */
export function RequestModal({ clientId, properties, request, onClose }: Readonly<RequestModalProps>) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [descricao, setDescricao] = useState(request?.descricao ?? '');
  const [status, setStatus] = useState<ServiceRequestStatus>(request?.status ?? 'em_analise');
  const [propertyId, setPropertyId] = useState(request?.propertyId ?? '');
  const [confirming, setConfirming] = useState(false);

  /** Atualiza a lista de solicitações e os contadores depois de uma mudança. */
  async function refresh(message: string) {
    await queryClient.invalidateQueries({ queryKey: clientKeys.requests(clientId) });
    await queryClient.invalidateQueries({ queryKey: clientKeys.list });
    show(message);
    onClose();
  }

  const save = useMutation({
    mutationFn: () => {
      if (request) return updateRequest(request.id, { descricao, status, propertyId: propertyId || null });
      return createRequest(clientId, { descricao, status, ...(propertyId ? { propertyId } : {}) });
    },
    onSuccess: () => refresh(request ? 'Solicitação atualizada.' : 'Solicitação adicionada.'),
  });

  const remove = useMutation({
    mutationFn: () => deleteRequest(request?.id ?? ''),
    onSuccess: () => refresh('Solicitação excluída.'),
  });

  if (confirming && request) {
    return (
      <ConfirmDialog
        title="Excluir solicitação"
        text={`Remover “${request.descricao}”?`}
        confirmLabel="Excluir"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <FormModal
      title={request ? 'Editar solicitação' : 'Nova solicitação'}
      submitLabel={request ? 'Salvar' : 'Adicionar'}
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
      onDelete={request ? () => setConfirming(true) : undefined}
    >
      <div className="field full">
        <label htmlFor="sol-descricao">O que foi solicitado</label>
        <textarea
          id="sol-descricao"
          value={descricao}
          placeholder="Ex.: infiltração na parede do quarto"
          onChange={(event) => setDescricao(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="sol-status">Status da atividade</label>
        <select id="sol-status" value={status} onChange={(event) => setStatus(event.target.value as ServiceRequestStatus)}>
          {SERVICE_REQUEST_STATUSES.map((value) => (
            <option key={value} value={value}>
              {SERVICE_REQUEST_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sol-imovel">Imóvel</label>
        <select id="sol-imovel" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
          <option value="">Sem imóvel definido</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.apelido}
            </option>
          ))}
        </select>
      </div>
    </FormModal>
  );
}
