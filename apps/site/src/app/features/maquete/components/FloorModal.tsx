import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FloorModalProps } from '../../../../types/maquete.types.ts';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { deleteFloor, updateFloor } from '../api.ts';
import { useRefreshMaquete } from '../hooks/useMaquete.ts';

/** Modal de renomear ou excluir um andar (excluir só quando há mais de um). */
export function FloorModal({ propertyId, floor, canDelete, onClose, onDeleted }: Readonly<FloorModalProps>) {
  const refresh = useRefreshMaquete(propertyId);
  const { show } = useToast();
  const [nome, setNome] = useState(floor.nome);
  const [confirming, setConfirming] = useState(false);

  const save = useMutation({
    mutationFn: () => updateFloor(floor.id, { nome }),
    onSuccess: async () => {
      await refresh();
      show('Andar atualizado.');
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteFloor(floor.id),
    onSuccess: async () => {
      await refresh();
      show('Andar excluído.');
      onDeleted();
    },
  });

  if (confirming) {
    return (
      <ConfirmDialog
        title="Excluir andar"
        text={remove.error ? errorMessage(remove.error) : `Remover “${floor.nome}” e os cômodos dele da maquete?`}
        confirmLabel="Excluir andar"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <FormModal
      title="Editar andar"
      submitLabel="Salvar"
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
      onDelete={canDelete ? () => setConfirming(true) : undefined}
      deleteLabel="Excluir andar"
    >
      <div className="field full">
        <label htmlFor="floor-nome">Nome do andar</label>
        <input id="floor-nome" value={nome} onChange={(event) => setNome(event.target.value)} />
      </div>
    </FormModal>
  );
}
