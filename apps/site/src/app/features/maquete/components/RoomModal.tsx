import { MAQUETE_COLUMNS } from '@fixable/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { RoomModalProps } from '../../../../types/maquete.types.ts';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { createRoom, deleteRoom, updateRoom } from '../api.ts';
import { useRefreshMaquete } from '../hooks/useMaquete.ts';

const WIDTHS = [
  { value: 1, label: 'Estreito (1)' },
  { value: 2, label: 'Médio (2)' },
  { value: 3, label: 'Largo (3)' },
  { value: 4, label: 'Muito largo (4)' },
];
const HEIGHTS = [
  { value: 1, label: 'Baixo (1)' },
  { value: 2, label: 'Alto (2)' },
];

/** Modal de criar, editar e excluir um cômodo; na edição a posição é dada por coluna e linha. */
export function RoomModal({ propertyId, floor, room, onClose }: Readonly<RoomModalProps>) {
  const refresh = useRefreshMaquete(propertyId);
  const { show } = useToast();
  const [nome, setNome] = useState(room?.nome ?? '');
  const [largura, setLargura] = useState(room?.largura ?? 2);
  const [altura, setAltura] = useState(room?.altura ?? 1);
  const [coluna, setColuna] = useState(String((room?.x ?? 0) + 1));
  const [linha, setLinha] = useState(String((room?.y ?? 0) + 1));
  const [confirming, setConfirming] = useState(false);

  /** Recarrega a maquete, avisa e fecha o modal. */
  async function finish(message: string) {
    await refresh();
    show(message);
    onClose();
  }

  const save = useMutation({
    mutationFn: () => {
      if (!room) return createRoom(floor.id, { nome, largura, altura });
      return updateRoom(room.id, { nome, largura, altura, x: Number(coluna) - 1, y: Number(linha) - 1 });
    },
    onSuccess: () => finish(room ? 'Cômodo atualizado.' : 'Cômodo adicionado à maquete.'),
  });

  const remove = useMutation({
    mutationFn: () => deleteRoom(room?.id ?? ''),
    onSuccess: () => finish('Cômodo excluído.'),
  });

  if (confirming && room) {
    return (
      <ConfirmDialog
        title="Excluir cômodo"
        text={`Remover “${room.nome}” da maquete?`}
        error={remove.error ? errorMessage(remove.error) : ''}
        confirmLabel="Excluir cômodo"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          remove.reset();
          setConfirming(false);
        }}
      />
    );
  }

  return (
    <FormModal
      title={room ? 'Editar cômodo' : `Novo cômodo em ${floor.nome}`}
      submitLabel={room ? 'Salvar' : 'Adicionar cômodo'}
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
      onDelete={room ? () => setConfirming(true) : undefined}
      deleteLabel="Excluir cômodo"
    >
      <div className="field full">
        <label htmlFor="room-nome">Nome do cômodo</label>
        <input id="room-nome" value={nome} placeholder="Ex.: Quarto 3" onChange={(event) => setNome(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="room-largura">Largura na maquete</label>
        <select id="room-largura" value={largura} onChange={(event) => setLargura(Number(event.target.value))}>
          {WIDTHS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="room-altura">Altura na maquete</label>
        <select id="room-altura" value={altura} onChange={(event) => setAltura(Number(event.target.value))}>
          {HEIGHTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {room ? (
        <>
          <div className="field">
            <label htmlFor="room-coluna">Coluna na planta (1 a {MAQUETE_COLUMNS})</label>
            <input id="room-coluna" type="number" min={1} max={MAQUETE_COLUMNS} value={coluna} onChange={(event) => setColuna(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="room-linha">Linha na planta</label>
            <input id="room-linha" type="number" min={1} value={linha} onChange={(event) => setLinha(event.target.value)} />
          </div>
        </>
      ) : null}
    </FormModal>
  );
}
