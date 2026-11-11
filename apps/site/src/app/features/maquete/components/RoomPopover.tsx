import type { RoomPopoverProps } from '../../../../types/maquete.types.ts';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';


/** Painel do cômodo selecionado, com a lista de serviços dele e as ações do engenheiro. */
export function RoomPopover({ room, services, editable, renderCards, onAddService, onEditRoom, onClose }: Readonly<RoomPopoverProps>) {
  return (
    <section className="mq-pop" aria-label={`Cômodo ${room.nome}`}>
      <h4>{room.nome}</h4>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        {editable ? (
          <>
            <button type="button" className="b-sm solid" onClick={onAddService}>
              + Adicionar serviço
            </button>
            <button type="button" className="b-sm" onClick={onEditRoom}>
              Editar cômodo
            </button>
          </>
        ) : null}
        <button type="button" className="b-sm" onClick={onClose}>
          Fechar
        </button>
      </div>
      {services.length === 0 ? (
        <EmptyState>Nenhum serviço neste cômodo.{editable ? ' Use “Adicionar serviço” para registrar um.' : ''}</EmptyState>
      ) : (
        renderCards(services)
      )}
    </section>
  );
}
