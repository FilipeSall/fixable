import { useState } from 'react';
import type { ClientTabKey, ClientWorkspaceProps } from '../../../../types/clientes.types.ts';
import type { TabItem } from '../../../../types/platform-ui.types.ts';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { TabPanel, Tabs } from '../../../shared/components/Tabs.tsx';
import { ClientTabPanel } from './ClientTabPanel.tsx';
import { NewPropertyModal } from './NewPropertyModal.tsx';
import { PropertySwitcher } from './PropertySwitcher.tsx';

const TABS: readonly TabItem<ClientTabKey>[] = [
  { key: 'solicitacoes', label: 'Solicitações' },
  { key: 'agendamentos', label: 'Agendamentos' },
  { key: 'servicos', label: 'Serviços em andamento' },
  { key: 'historico', label: 'Histórico de manutenção' },
  { key: 'residencia', label: 'Dados da residência' },
];

/** Conteúdo da página do cliente: troca de imóvel e as abas; o engenheiro edita, o cliente só lê. */
export function ClientWorkspace({ client, editable }: Readonly<ClientWorkspaceProps>) {
  const [tab, setTab] = useState<ClientTabKey>('solicitacoes');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const property = client.properties.find((item) => item.id === chosenId) ?? client.properties[0];

  /** Seleciona o imóvel recém-criado e fecha o modal. */
  function handleCreated(id: string) {
    setChosenId(id);
    setAdding(false);
  }

  return (
    <>
      <PropertySwitcher
        properties={client.properties}
        activeId={property?.id ?? ''}
        onChange={setChosenId}
        onAdd={editable ? () => setAdding(true) : undefined}
      />
      <Tabs items={TABS} active={tab} onChange={setTab} label="Abas do cliente" idPrefix="cliente" />
      {property ? (
        <TabPanel idPrefix="cliente" active={tab}>
          <ClientTabPanel tab={tab} clientId={client.id} property={property} properties={client.properties} editable={editable} />
        </TabPanel>
      ) : (
        <EmptyState>Nenhum imóvel cadastrado.</EmptyState>
      )}
      {adding ? <NewPropertyModal clientId={client.id} onClose={() => setAdding(false)} onCreated={handleCreated} /> : null}
    </>
  );
}
