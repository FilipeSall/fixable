import type { Service } from '@fixable/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { MaqueteDialog, MaqueteTabProps } from '../../../../types/maquete.types.ts';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { createFloor } from '../api.ts';
import { useFloorplan, useRefreshMaquete } from '../hooks/useMaquete.ts';
import { locationOf, servicesOfFloor, servicesOfRoom, sortServices } from '../lib/maquete.ts';
import { FloorColumn } from './FloorColumn.tsx';
import { MaqueteDialogs } from './MaqueteDialogs.tsx';
import { RoomGrid } from './RoomGrid.tsx';
import { RoomPopover } from './RoomPopover.tsx';
import { ServiceCard } from './ServiceCard.tsx';

const LEGEND = [
  { status: 'prioridade', label: 'Prioridade' },
  { status: 'atencao', label: 'Precisa de atenção' },
  { status: 'execucao', label: 'Em execução' },
  { status: 'concluido', label: 'Concluído (visível por 24 h)' },
] as const;

const SUB_EDIT = 'Toque em um cômodo para adicionar ou editar serviços.';
const SUB_READ = 'Toque em um cômodo para ver o andamento dos serviços.';

/** Aba "Serviços em andamento": maquete por andar e cômodo, com os serviços e as ações do engenheiro. */
export function MaqueteTab({ property, editable }: Readonly<MaqueteTabProps>) {
  const { data, error, isPending, dataUpdatedAt } = useFloorplan(property.id);
  const refresh = useRefreshMaquete(property.id);
  const { show } = useToast();
  const [floorId, setFloorId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<MaqueteDialog>(null);

  const addFloor = useMutation({
    mutationFn: () => createFloor(property.id),
    onSuccess: async (created) => {
      await refresh();
      setFloorId(created.id);
      setRoomId(null);
      show(`${created.nome} adicionado. Agora adicione os cômodos.`);
    },
  });

  if (isPending) return <p role="status">Carregando...</p>;
  if (!data) return <p role="alert">{errorMessage(error)}</p>;
  const floor = data.floors.find((item) => item.id === floorId) ?? data.floors[0];
  if (!floor) return <EmptyState>Nenhum andar cadastrado.</EmptyState>;
  const room = floor.rooms.find((item) => item.id === roomId) ?? null;
  const floorServices = sortServices(servicesOfFloor(data.services, floor));
  const floors = data.floors;

  /** Monta os cartões de uma lista de serviços. */
  function cards(services: readonly Service[]) {
    return services.map((service) => (
      <ServiceCard
        key={service.id}
        service={service}
        location={locationOf(floors, service.roomId)}
        editable={editable}
        now={dataUpdatedAt}
        onEdit={(item) => setDialog({ kind: 'service', service: item })}
        onComplete={(item) => setDialog({ kind: 'complete', service: item })}
      />
    ));
  }

  /** Troca o andar exibido e fecha o cômodo aberto. */
  function selectFloor(id: string | null) {
    setFloorId(id);
    setRoomId(null);
  }

  return (
    <>
      <p className="app-sub">Maquete virtual da residência por andar e cômodo. {editable ? SUB_EDIT : SUB_READ}</p>
      <div className="mq-wrap">
        <div>
          <RoomGrid floor={floor} services={data.services} selectedRoomId={room?.id ?? null} editable={editable} onSelect={setRoomId} />
          <div className="cal-legend">
            {LEGEND.map((item) => (
              <span key={item.status}>
                <i className={`mq-dot ${item.status}`} style={{ width: 10, height: 10 }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <FloorColumn
          floors={floors}
          services={data.services}
          activeFloorId={floor.id}
          editable={editable}
          onSelect={selectFloor}
          onAddFloor={() => addFloor.mutate()}
          onAddRoom={() => setDialog({ kind: 'room', room: null })}
          onEditFloor={() => setDialog({ kind: 'floor' })}
        />
      </div>
      {addFloor.error ? <p role="alert">{errorMessage(addFloor.error)}</p> : null}
      {room ? (
        <RoomPopover
          room={room}
          services={sortServices(servicesOfRoom(data.services, room.id))}
          editable={editable}
          renderCards={cards}
          onAddService={() => setDialog({ kind: 'service', service: null })}
          onEditRoom={() => setDialog({ kind: 'room', room })}
          onClose={() => setRoomId(null)}
        />
      ) : null}
      <h3 className="ag-list-title">Serviços em {floor.nome}</h3>
      {floorServices.length === 0 ? <EmptyState>Nenhum serviço ativo neste andar.</EmptyState> : cards(floorServices)}
      <MaqueteDialogs
        dialog={dialog}
        property={property}
        floors={floors}
        floor={floor}
        selectedRoomId={room?.id ?? null}
        onClose={() => setDialog(null)}
        onFloorDeleted={() => {
          setDialog(null);
          selectFloor(null);
        }}
      />
    </>
  );
}
