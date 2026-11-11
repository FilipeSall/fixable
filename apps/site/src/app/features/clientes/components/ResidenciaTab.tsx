import type { PropertyAttribute } from '@fixable/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ClientTabProps } from '../../../../types/clientes.types.ts';
import { AddBox } from '../../../shared/components/AddBox.tsx';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { clientKeys, deleteAttribute } from '../api.ts';
import { useAttributes } from '../hooks/useClientes.ts';
import { AttributeModal } from './AttributeModal.tsx';

/** Aba "Dados da residência": pares informação/valor do imóvel; só o engenheiro edita. */
export function ResidenciaTab({ property, editable }: Readonly<ClientTabProps>) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { data, error, isPending } = useAttributes(property.id);
  const [editing, setEditing] = useState<PropertyAttribute | null | 'new'>(null);
  const [removing, setRemoving] = useState<PropertyAttribute | null>(null);

  const remove = useMutation({
    mutationFn: (attr: PropertyAttribute) => deleteAttribute(property.id, attr.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clientKeys.attributes(property.id) });
      show('Informação removida.');
      setRemoving(null);
    },
  });

  return (
    <>
      {isPending ? <p role="status">Carregando...</p> : null}
      {error ? <p role="alert">{errorMessage(error)}</p> : null}
      {data?.length === 0 ? <EmptyState>Nenhum dado cadastrado.</EmptyState> : null}
      <div className="rows">
        {data?.map((attr) => (
          <div key={attr.id} className="kv">
            <span className="k">{attr.chave}</span>
            <span className="v">{attr.valor}</span>
            {editable ? (
              <span className="btn-row">
                <button type="button" className="b-sm" onClick={() => setEditing(attr)}>
                  Editar
                </button>
                <button type="button" className="b-sm danger" onClick={() => setRemoving(attr)}>
                  Excluir
                </button>
              </span>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
      {editable ? (
        <AddBox label="Adicionar informação" below onClick={() => setEditing('new')} />
      ) : (
        <p className="hint" style={{ marginTop: 12 }}>
          Dados enviados no formulário “Solicite seu diagnóstico” e atualizados pelo seu engenheiro.
        </p>
      )}
      {remove.error ? <p role="alert">{errorMessage(remove.error)}</p> : null}
      {editing ? (
        <AttributeModal propertyId={property.id} attribute={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir informação"
          text={`Remover “${removing.chave}” dos dados da residência?`}
          confirmLabel="Excluir"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
