import { useParams } from 'react-router';
import { NotFoundPage } from '../../../NotFoundPage.tsx';
import { Crumbs } from '../../../shared/components/Crumbs.tsx';
import { errorMessage, isMissing } from '../../../shared/lib/errors.ts';
import { ClientWorkspace } from '../components/ClientWorkspace.tsx';
import { useClient } from '../hooks/useClientes.ts';

/** Página do cliente vista pelo engenheiro, com edição de todas as abas. */
export function ClientePage() {
  const { clientId = '' } = useParams();
  const { data, error, isPending } = useClient(clientId);
  if (isMissing(error)) return <NotFoundPage embedded />;
  if (isPending) return <p role="status">Carregando...</p>;
  if (!data) return <p role="alert">{errorMessage(error)}</p>;
  return (
    <>
      <Crumbs items={[{ label: 'Clientes', to: '/clientes' }, { label: data.nome }]} />
      <h1 className="app-h">{data.nome}</h1>
      <p className="app-sub">Página do cliente · você pode editar todas as informações. O cliente vê as mesmas abas, sem edição.</p>
      <ClientWorkspace client={data} editable />
    </>
  );
}
