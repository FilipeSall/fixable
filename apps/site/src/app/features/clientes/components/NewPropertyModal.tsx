import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from '@fixable/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { NewPropertyModalProps } from '../../../../types/clientes.types.ts';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { clientKeys, createProperty } from '../api.ts';

/** Modal de cadastrar um novo imóvel do cliente, que já nasce com a planta padrão do tipo. */
export function NewPropertyModal({ clientId, onCreated, onClose }: Readonly<NewPropertyModalProps>) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [apelido, setApelido] = useState('');
  const [tipo, setTipo] = useState<PropertyType>('casa_terrea');
  const [cidade, setCidade] = useState('');

  const save = useMutation({
    mutationFn: () => createProperty(clientId, { apelido, tipo, cidade }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
      await queryClient.invalidateQueries({ queryKey: clientKeys.list });
      show('Imóvel adicionado.');
      onCreated(created.id);
    },
  });

  return (
    <FormModal
      title="Novo imóvel"
      submitLabel="Adicionar imóvel"
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
    >
      <div className="field full">
        <label htmlFor="imovel-apelido">Apelido</label>
        <input id="imovel-apelido" value={apelido} placeholder="Ex.: Casa da praia" onChange={(event) => setApelido(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="imovel-tipo">Tipo de imóvel</label>
        <select id="imovel-tipo" value={tipo} onChange={(event) => setTipo(event.target.value as PropertyType)}>
          {PROPERTY_TYPES.map((value) => (
            <option key={value} value={value}>
              {PROPERTY_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="imovel-cidade">Cidade</label>
        <input id="imovel-cidade" value={cidade} onChange={(event) => setCidade(event.target.value)} />
      </div>
    </FormModal>
  );
}
