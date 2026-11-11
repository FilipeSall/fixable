import { API, DEMO_SENHA, type DemoAccount, type Role } from '@fixable/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../api.ts';
import type { AccessCardProps } from '../../../types/auth-screens.types.ts';
import { Avatar } from '../../shared/components/Avatar.tsx';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  engenheiro: 'Engenheiro responsável',
  cliente: 'Cliente',
  profissional: 'Profissional parceiro',
};

/** Busca as contas de demonstração; a API responde 404 quando o modo demo está desligado. */
function fetchDemoAccounts(): Promise<DemoAccount[]> {
  return apiFetch<DemoAccount[]>(API.demoAccounts);
}

/** Cartão ao lado do login: contas de demonstração (modo demo) ou como conseguir acesso. */
export function AccessCard({ onPick }: Readonly<AccessCardProps>) {
  const { data, isPending } = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: fetchDemoAccounts,
    retry: false,
    staleTime: Infinity,
  });
  const [picked, setPicked] = useState<string | null>(null);

  if (isPending) return <div className="access-pending" aria-hidden="true" />;

  if (data && data.length > 0 && onPick) {
    return (
      <>
        <h2 className="login-card-title">Contas de demonstração</h2>
        <p className="hint access-intro">Clique em uma conta para preencher o acesso. Senha de todas: {DEMO_SENHA}.</p>
        {data.map((account) => (
          <button
            key={account.email}
            type="button"
            className="demo-acc"
            aria-label={`Preencher acesso de ${account.nome} (${ROLE_LABELS[account.role]})`}
            onClick={() => {
              setPicked(account.nome);
              onPick(account.email);
            }}
          >
            <Avatar nome={account.nome} size="sm" />
            <span>
              <strong>{account.nome}</strong>
              <span>{account.descricao || ROLE_LABELS[account.role]}</span>
            </span>
            <span className="tag">{ROLE_LABELS[account.role]}</span>
          </button>
        ))}
        <p className="hint access-picked" role="status">
          {picked ? `Acesso de ${picked} preenchido. Clique em Entrar.` : ''}
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="login-card-title">Como ter acesso</h2>
      <p className="hint access-text">
        O acesso é criado pela Fixable. Clientes recebem o convite por e-mail depois de solicitar o diagnóstico; profissionais e
        engenheiros, depois da aprovação do cadastro.
      </p>
      <a className="btn btn-primary btn-block" href="/#solicitar">
        Solicitar diagnóstico
      </a>
    </>
  );
}
