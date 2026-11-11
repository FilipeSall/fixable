import { useState } from 'react';
import type { HistoricoTabProps } from '../../../../types/maquete.types.ts';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { Pill } from '../../../shared/components/Pill.tsx';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { formatDateTime } from '../../../shared/lib/format.ts';
import { useHistory } from '../hooks/useMaquete.ts';

/** Aba de histórico de manutenção: serviços concluídos, com a descrição ao expandir. */
export function HistoricoTab({ property }: Readonly<HistoricoTabProps>) {
  const { data, error, isPending } = useHistory(property.id);
  const [openId, setOpenId] = useState<string | null>(null);
  if (isPending) return <p role="status">Carregando...</p>;
  if (!data) return <p role="alert">{errorMessage(error)}</p>;
  if (data.length === 0) {
    return (
      <EmptyState>
        Ainda não há serviços concluídos. Quando um serviço for marcado como concluído, ele aparece aqui automaticamente.
      </EmptyState>
    );
  }
  return (
    <div>
      {data.map((item) => {
        const open = item.id === openId;
        const local = item.andar && item.comodo ? `${item.andar} · ${item.comodo}` : 'Cômodo removido';
        return (
          <div key={item.id} className={open ? 'ag-card sel' : 'ag-card'}>
            <div className="ag-main">
              <div className="ag-info">
                <strong>{item.titulo}</strong>
                <small>
                  {local} · Concluído em {formatDateTime(item.concludedAt)}
                </small>
              </div>
              <Pill color="green">Concluído</Pill>
              <button
                type="button"
                className={open ? 'icon-btn open' : 'icon-btn'}
                aria-expanded={open}
                aria-label={`Ver detalhes de ${item.titulo}`}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                ›
              </button>
            </div>
            {open ? (
              <div className="ag-detail">
                <div className="det-block">
                  <h5>Descrição</h5>
                  <p>{item.descricao ?? 'Sem descrição.'}</p>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
