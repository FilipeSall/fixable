import { SERVICE_STATUSES, SERVICE_STATUS_LABELS, type ServiceStatus } from '@fixable/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { ServiceModalProps } from '../../../../types/maquete.types.ts';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { createService, updateService } from '../api.ts';
import { useRefreshMaquete } from '../hooks/useMaquete.ts';

/** Modal de adicionar ou editar um serviço num cômodo da maquete. */
export function ServiceModal({ propertyId, floors, service, defaultRoomId, onClose }: Readonly<ServiceModalProps>) {
  const refresh = useRefreshMaquete(propertyId);
  const { show } = useToast();
  const firstRoom = floors.flatMap((floor) => floor.rooms)[0]?.id ?? '';
  const [titulo, setTitulo] = useState(service?.titulo ?? '');
  const [roomId, setRoomId] = useState(service?.roomId ?? defaultRoomId ?? firstRoom);
  const [status, setStatus] = useState<ServiceStatus>(service?.status ?? 'atencao');
  const [prazo, setPrazo] = useState(service?.prazo ?? '');
  const [percentual, setPercentual] = useState(String(service?.percentual ?? 0));
  const [descricao, setDescricao] = useState(service?.descricao ?? '');

  const save = useMutation({
    mutationFn: () => {
      const base = { roomId, titulo, status, percentual: Number(percentual) };
      if (service) return updateService(service.id, { ...base, descricao, prazo: prazo || null });
      return createService(propertyId, { ...base, ...(descricao ? { descricao } : {}), ...(prazo ? { prazo } : {}) });
    },
    onSuccess: async () => {
      await refresh();
      show(status === 'concluido' ? 'Serviço concluído e enviado ao histórico de manutenção.' : 'Serviço salvo na maquete.');
      onClose();
    },
  });

  return (
    <FormModal
      title={service ? 'Editar serviço' : 'Adicionar serviço'}
      submitLabel={service ? 'Salvar' : 'Adicionar serviço'}
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
    >
      <div className="field full">
        <label htmlFor="svc-titulo">Tarefa</label>
        <input id="svc-titulo" value={titulo} placeholder="Ex.: Trocar torneira do tanque" onChange={(event) => setTitulo(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="svc-comodo">Cômodo</label>
        <select id="svc-comodo" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
          {floors.map((floor) => (
            <optgroup key={floor.id} label={floor.nome}>
              {floor.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {floor.nome} · {room.nome}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="svc-status">Status e prioridade</label>
        <select id="svc-status" value={status} onChange={(event) => setStatus(event.target.value as ServiceStatus)}>
          {SERVICE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {SERVICE_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="svc-prazo">Prazo</label>
        <input id="svc-prazo" type="date" value={prazo} onChange={(event) => setPrazo(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="svc-percentual">Progresso (%)</label>
        <input id="svc-percentual" type="number" min={0} max={100} value={percentual} onChange={(event) => setPercentual(event.target.value)} />
      </div>
      <div className="field full">
        <label htmlFor="svc-descricao">Descrição da tarefa</label>
        <textarea id="svc-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </div>
    </FormModal>
  );
}
