import type { AppointmentActionsProps } from '../../../../types/agenda-ui.types.ts';

/** Botões do engenheiro no agendamento aberto: confirmar, pendente, adiar, editar e excluir. */
export function AppointmentActions({ busy, onStatus, onEdit, onDelete }: Readonly<AppointmentActionsProps>) {
  return (
    <div className="btn-row">
      <button type="button" className="b-sm green" disabled={busy} onClick={() => onStatus('confirmado')}>
        Confirmar
      </button>
      <button type="button" className="b-sm yellow" disabled={busy} onClick={() => onStatus('pendente')}>
        Marcar pendente
      </button>
      <button type="button" className="b-sm danger" disabled={busy} onClick={() => onStatus('adiado')}>
        Adiar
      </button>
      {onEdit ? (
        <button type="button" className="b-sm" onClick={onEdit}>
          Editar
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className="b-sm danger" onClick={onDelete}>
          Excluir
        </button>
      ) : null}
    </div>
  );
}
