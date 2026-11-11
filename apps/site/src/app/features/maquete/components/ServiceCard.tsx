import { SERVICE_STATUS_LABELS } from '@fixable/shared';
import type { ServiceCardProps } from '../../../../types/maquete.types.ts';
import { Pill } from '../../../shared/components/Pill.tsx';
import { formatDate } from '../../../shared/lib/format.ts';
import { hoursLeft, STATUS_PILL } from '../lib/maquete.ts';

/** Cartão de serviço da maquete, com progresso, prazo e as ações do engenheiro. */
export function ServiceCard({ service, location, editable, now, onEdit, onComplete }: Readonly<ServiceCardProps>) {
  const concluded = service.status === 'concluido';
  const percent = concluded ? 100 : service.percentual;
  return (
    <article className={`svc-card ${service.status}`}>
      <div className="svc-head">
        <div>
          <strong>{service.titulo}</strong>
          <small>{location}</small>
        </div>
        <Pill color={STATUS_PILL[service.status]}>{SERVICE_STATUS_LABELS[service.status]}</Pill>
      </div>
      {service.descricao ? <p>{service.descricao}</p> : null}
      <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
        <i className={service.status} style={{ width: `${percent}%` }} />
      </div>
      <div className="svc-foot">
        <span>{percent}% concluído</span>
        <span>Prazo: {formatDate(service.prazo)}</span>
      </div>
      {concluded && service.concludedAt ? (
        <p className="hint" style={{ margin: '10px 0 0' }}>
          Já está no histórico de manutenção. Sai desta lista em cerca de {hoursLeft(service.concludedAt, now)} h.
        </p>
      ) : null}
      {editable && !concluded ? (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="b-sm" onClick={() => onEdit(service)}>
            Editar
          </button>
          <button type="button" className="b-sm green" onClick={() => onComplete(service)}>
            Marcar como concluído
          </button>
        </div>
      ) : null}
    </article>
  );
}
