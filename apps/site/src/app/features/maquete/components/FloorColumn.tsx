import type { FloorColumnProps } from '../../../../types/maquete.types.ts';
import { activeCount, serviceCountLabel, servicesOfFloor } from '../lib/maquete.ts';

/** Coluna de andares da maquete, com as ações de andar e cômodo para o engenheiro. */
export function FloorColumn({ floors, services, activeFloorId, editable, onSelect, onAddFloor, onAddRoom, onEditFloor }: Readonly<FloorColumnProps>) {
  return (
    <div className="mq-floors">
      {editable ? (
        <>
          <button type="button" className="b-sm solid" onClick={onAddFloor}>
            + Adicionar andar
          </button>
          <button type="button" className="b-sm" onClick={onAddRoom}>
            + Adicionar cômodo
          </button>
        </>
      ) : null}
      <span className="lbl">Andares</span>
      {floors.map((floor) => (
        <button
          key={floor.id}
          type="button"
          className={floor.id === activeFloorId ? 'floor-btn active' : 'floor-btn'}
          aria-pressed={floor.id === activeFloorId}
          onClick={() => onSelect(floor.id)}
        >
          {floor.nome} · {serviceCountLabel(activeCount(servicesOfFloor(services, floor)))}
        </button>
      ))}
      {editable ? (
        <button type="button" className="link" onClick={onEditFloor}>
          Renomear ou excluir este andar
        </button>
      ) : null}
    </div>
  );
}
