import { SERVICE_STATUS_LABELS } from '@fixable/shared';
import type { RoomGridProps } from '../../../../types/maquete.types.ts';
import { placementOf, rowCountOf, serviceCountLabel, servicesOfRoom } from '../lib/maquete.ts';

/** Planta do andar: grade de 6 colunas com os cômodos e um ponto colorido por serviço. */
export function RoomGrid({ floor, services, selectedRoomId, editable, onSelect }: Readonly<RoomGridProps>) {
  if (floor.rooms.length === 0) {
    return <div className="mq-stage" style={{ display: 'block' }}><p className="hint">Nenhum cômodo neste andar.</p></div>;
  }
  return (
    <div className="mq-stage" style={{ gridTemplateRows: `repeat(${rowCountOf(floor, editable)}, var(--mq-row))` }}>
      {floor.rooms.map((room) => {
        const roomServices = servicesOfRoom(services, room.id);
        return (
          <button
            key={room.id}
            type="button"
            className={room.id === selectedRoomId ? 'mq-room sel' : 'mq-room'}
            style={placementOf(room)}
            aria-label={`${room.nome} — ${serviceCountLabel(roomServices.length)}`}
            aria-pressed={room.id === selectedRoomId}
            onClick={() => onSelect(room.id)}
          >
            <span className="nm">{room.nome}</span>
            <span className="mq-dots">
              {roomServices.map((service) => (
                <i key={service.id} className={`mq-dot ${service.status}`} title={`${service.titulo} — ${SERVICE_STATUS_LABELS[service.status]}`} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
