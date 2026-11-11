import { errorMessage } from '../../../shared/lib/errors.ts';
import { firstName } from '../../../shared/lib/format.ts';
import { ClientWorkspace } from '../components/ClientWorkspace.tsx';
import { useClient, useMeClient } from '../hooks/useClientes.ts';

/** Saudação do painel do cliente, citando o engenheiro responsável quando houver. */
function subtitleOf(engenheiro: string | undefined): string {
  return engenheiro
    ? `Acompanhe sua casa e seus serviços. Seu engenheiro responsável é ${engenheiro}.`
    : 'Acompanhe sua casa e seus serviços.';
}

/** Conteúdo do painel quando o id do cliente já é conhecido. */
function Painel({ clientId }: Readonly<{ clientId: string }>) {
  const { data, error, isPending } = useClient(clientId);
  if (isPending) return <p role="status">Carregando...</p>;
  if (!data) return <p role="alert">{errorMessage(error)}</p>;
  return (
    <>
      <h1 className="app-h">Olá, {firstName(data.nome)}.</h1>
      <p className="app-sub">{subtitleOf(data.engenheiro?.nome)}</p>
      <ClientWorkspace client={data} editable={false} />
    </>
  );
}

/** Painel do cliente: a mesma página do engenheiro, só para leitura. */
export function MeuPainelPage() {
  const { data, error, isPending } = useMeClient();
  if (isPending) return <p role="status">Carregando...</p>;
  if (!data) return <p role="alert">{errorMessage(error)}</p>;
  return <Painel clientId={data.clientId} />;
}
