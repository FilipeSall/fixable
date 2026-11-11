import { APPOINTMENT_STATUS_LABELS } from '@fixable/shared';
import type { AppointmentCardProps } from '../../../../types/agenda-ui.types.ts';
import { Pill } from '../../../shared/components/Pill.tsx';
import { formatDate } from '../../../shared/lib/format.ts';
import { MONTH_ABBR, STATUS_PILL } from '../lib/calendar.ts';

/** Cartão expansível de agendamento, com as ações de status e edição para o engenheiro. */
export function AppointmentCard({ appointment, open, editable, onToggle, onStatus, onEdit, onDelete }: Readonly<AppointmentCardProps>) {
  const month = MONTH_ABBR[Number(appointment.data.slice(5, 7)) - 1] ?? '';
  const who = appointment.clientNome ?? appointment.propertyApelido ?? '';
  return (
    <div className={open ? 'ag-card sel' : 'ag-card'}>
      <div className="ag-main">
        <div className="ag-date">
          <b>{appointment.data.slice(8, 10)}</b>
          <small>{month}</small>
        </div>
        <div className="ag-info">
          <strong>{appointment.servico}</strong>
          {who ? <small>{who}</small> : null}
          <small>
            {formatDate(appointment.data)} · {appointment.hora.slice(0, 5)}
          </small>
        </div>
        <Pill color={STATUS_PILL[appointment.status]}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</Pill>
        <button type="button" className={open ? 'icon-btn open' : 'icon-btn'} aria-expanded={open} aria-label="Ver detalhes do serviço" onClick={onToggle}>
          ›
        </button>
      </div>
      {open ? (
        <div className="ag-detail">
          <div className="det-grid">
            <div>
              <div className="det-block">
                <h5>Serviço</h5>
                <p>{appointment.servico}</p>
              </div>
              <div className="det-block">
                <h5>Descrição do serviço</h5>
                <p>{appointment.descricao ?? 'Sem descrição.'}</p>
              </div>
            </div>
            <div>
              {appointment.clientNome ? (
                <div className="det-block">
                  <h5>Cliente atendido</h5>
                  <p>{appointment.clientNome}</p>
                </div>
              ) : null}
              <div className="det-block">
                <h5>Imóvel</h5>
                <p>{appointment.propertyApelido ?? '—'}</p>
              </div>
            </div>
          </div>
          {editable && onStatus ? (
            <div className="btn-row">
              <button type="button" className="b-sm green" onClick={() => onStatus('confirmado')}>
                Confirmar
              </button>
              <button type="button" className="b-sm yellow" onClick={() => onStatus('pendente')}>
                Marcar pendente
              </button>
              <button type="button" className="b-sm danger" onClick={() => onStatus('adiado')}>
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
