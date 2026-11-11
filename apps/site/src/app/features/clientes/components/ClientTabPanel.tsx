import type { ClientTabKey, ClientTabProps } from '../../../../types/clientes.types.ts';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { HistoricoTab } from '../../maquete/components/HistoricoTab.tsx';
import { MaqueteTab } from '../../maquete/components/MaqueteTab.tsx';
import { ResidenciaTab } from './ResidenciaTab.tsx';
import { SolicitacoesTab } from './SolicitacoesTab.tsx';

/** Conteúdo da aba escolhida da página do cliente, para o imóvel selecionado. */
export function ClientTabPanel({ tab, ...props }: Readonly<ClientTabProps & { tab: ClientTabKey }>) {
  const key = props.property.id;
  switch (tab) {
    case 'solicitacoes':
      return <SolicitacoesTab {...props} />;
    case 'servicos':
      return <MaqueteTab key={key} property={props.property} editable={props.editable} />;
    case 'historico':
      return <HistoricoTab key={key} property={props.property} />;
    case 'residencia':
      return <ResidenciaTab key={key} {...props} />;
    default:
      return <EmptyState>Disponível em breve.</EmptyState>;
  }
}
