import { PROPERTY_TYPE_LABELS, planName, type AdminLead } from '@fixable/shared';
import { useState } from 'react';
import type { LeadFilter } from '../../../../types/admin-ui.types.ts';
import type { TabItem } from '../../../../types/platform-ui.types.ts';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { Pill } from '../../../shared/components/Pill.tsx';
import { RowCard } from '../../../shared/components/RowCard.tsx';
import { StatRow } from '../../../shared/components/StatRow.tsx';
import { TabPanel, Tabs } from '../../../shared/components/Tabs.tsx';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { formatDateTime } from '../../../shared/lib/format.ts';
import { useLeads } from '../hooks/useAdmin.ts';

const FILTERS: readonly TabItem<LeadFilter>[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'sem', label: 'Sem atribuição' },
];

/** Linha descritiva do lead: cidade, tipo de imóvel, plano e data. */
function detailsOf(lead: AdminLead): string {
  const parts = [lead.cidade, PROPERTY_TYPE_LABELS[lead.tipoImovel], lead.plano ? planName(lead.plano) : null, formatDateTime(lead.createdAt)];
  return parts.filter(Boolean).join(' · ');
}

/** Leads de diagnóstico para o admin, com filtro dos que estão sem engenheiro. */
export function LeadsPage() {
  const [filter, setFilter] = useState<LeadFilter>('todos');
  const all = useLeads('todos');
  const current = useLeads(filter);
  const semAtribuicao = all.data?.filter((lead) => lead.engenheiro === null).length ?? 0;

  return (
    <>
      <h1 className="app-h">Leads</h1>
      <p className="app-sub">Pedidos de diagnóstico enviados pelo site. Os sem engenheiro precisam de atenção.</p>
      {all.data ? (
        <StatRow
          items={[
            { label: 'Leads recebidos', value: all.data.length },
            { label: 'Sem atribuição', value: semAtribuicao },
          ]}
        />
      ) : null}
      <Tabs items={FILTERS} active={filter} onChange={setFilter} label="Filtro de leads" idPrefix="leads" />
      <TabPanel idPrefix="leads" active={filter}>
      {current.isPending ? <p role="status">Carregando...</p> : null}
      {current.error ? <p role="alert">{errorMessage(current.error)}</p> : null}
      {current.data?.length === 0 ? <EmptyState>Nenhum lead neste filtro.</EmptyState> : null}
      <div className="rows">
        {current.data?.map((lead) => (
          <RowCard
            key={lead.id}
            title={`${lead.nome} · ${lead.email} · ${lead.telefone}`}
            subtitle={detailsOf(lead)}
            right={lead.engenheiro ? <Pill color="clay">{lead.engenheiro.nome}</Pill> : <Pill color="yellow">Sem atribuição</Pill>}
          />
        ))}
      </div>
      </TabPanel>
    </>
  );
}
