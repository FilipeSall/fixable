import { APPOINTMENT_STATUS_LABELS } from '@fixable/shared';
import type { AppointmentCardProps } from '../../../../types/agenda-ui.types.ts';
import { Pill } from '../../../shared/components/Pill.tsx';
import { formatDate } from '../../../shared/lib/format.ts';
import { MONTH_ABBR, STATUS_PILL } from '../lib/calendar.ts';
import { AppointmentActions } from './AppointmentActions.tsx';

/** Cartão expansível de agendamento, com as ações de status e edição para o engenheiro. */
export function AppointmentCard({ appointment, open, editable, onToggle, onStatus, onEdit, onDelete, busy = false }: Readonly<AppointmentCardProps>) {
  const month = MONTH_ABBR[Number(appointment.data.slice(5, 7)) - 1] ?? '';
  const clientNome = 'clientNome' in appointment ? appointment.clientNome : null;
  const who = clientNome ?? appointment.propertyApelido ?? '';
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
              {clientNome ? (
                <div className="det-block">
                  <h5>Cliente atendido</h5>
                  <p>{clientNome}</p>
                </div>
              ) : null}
              <div className="det-block">
                <h5>Imóvel</h5>
                <p>{appointment.propertyApelido ?? '—'}</p>
              </div>
            </div>
          </div>
          {editable && onStatus ? <AppointmentActions busy={busy} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} /> : null}
        </div>
      ) : null}
    </div>
  );
}
