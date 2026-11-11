import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { StatRow } from '../../../shared/components/StatRow.tsx';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { ClientCard } from '../components/ClientCard.tsx';
import { useClientList } from '../hooks/useClientes.ts';

/** Lista de clientes do engenheiro, com os números de resumo e um cartão por cliente. */
export function ClientesPage() {
  const { data, error, isPending } = useClientList();
  return (
    <>
      <h1 className="app-h">Clientes</h1>
      <p className="app-sub">Escolha um cliente para abrir a página dele.</p>
      {isPending ? <p role="status">Carregando...</p> : null}
      {error ? <p role="alert">{errorMessage(error)}</p> : null}
      {data ? (
        <>
          <StatRow
            items={[
              { label: 'Clientes vinculados', value: data.stats.clientes },
              { label: 'Solicitações em aberto', value: data.stats.solicitacoesAbertas },
              { label: 'Serviços em andamento', value: data.stats.servicosEmAndamento },
              { label: 'Agendamentos a confirmar', value: data.stats.agendamentosAConfirmar },
            ]}
          />
          {data.clients.length === 0 ? (
            <EmptyState>
              Nenhum cliente vinculado ainda. Quando alguém enviar o formulário “Solicite seu diagnóstico”, o cliente
              aparece aqui.
            </EmptyState>
          ) : (
            <div className="client-grid">
              {data.clients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
