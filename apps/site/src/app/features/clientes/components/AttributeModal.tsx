import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AttributeModalProps } from '../../../../types/clientes.types.ts';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { clientKeys, createAttribute, updateAttribute } from '../api.ts';

/** Modal de adicionar ou editar uma informação dos dados da residência. */
export function AttributeModal({ propertyId, attribute, onClose }: Readonly<AttributeModalProps>) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [chave, setChave] = useState(attribute?.chave ?? '');
  const [valor, setValor] = useState(attribute?.valor ?? '');

  const save = useMutation({
    mutationFn: () =>
      attribute ? updateAttribute(propertyId, attribute.id, { chave, valor }) : createAttribute(propertyId, { chave, valor }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clientKeys.attributes(propertyId) });
      show(attribute ? 'Dados da residência atualizados.' : 'Informação adicionada.');
      onClose();
    },
  });

  return (
    <FormModal
      title={attribute ? 'Editar informação' : 'Nova informação da residência'}
      submitLabel={attribute ? 'Salvar' : 'Adicionar'}
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="res-chave">Informação</label>
        <input id="res-chave" value={chave} placeholder="Ex.: Área construída" onChange={(event) => setChave(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="res-valor">Valor</label>
        <input id="res-valor" value={valor} placeholder="Ex.: 180 m²" onChange={(event) => setValor(event.target.value)} />
      </div>
    </FormModal>
  );
}
