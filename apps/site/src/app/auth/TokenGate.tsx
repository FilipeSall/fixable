import { API } from '@fixable/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiRequestError, apiFetch } from '../api.ts';
import { messageOf } from './form-errors.ts';

interface TokenInfo {
  purpose: 'convite' | 'redefinicao';
  nome: string;
  email: string;
}

interface Props {
  purpose: TokenInfo['purpose'];
  children: (token: string, info: TokenInfo) => ReactNode;
}

export const EXPIRED_MESSAGE = 'Este link expirou ou já foi usado.';

function Expired() {
  return (
    <>
      <p role="alert" className="err">
        {EXPIRED_MESSAGE}
      </p>
      <p className="auth-switch">
        <Link to="/esqueci-senha">Pedir um novo link</Link>
      </p>
    </>
  );
}

const HTTP_GONE = 410;

function isGone(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === HTTP_GONE;
}

function TokenLookup({ token, purpose, children }: Readonly<Props & { token: string }>) {
  const query = useQuery({
    queryKey: ['token-info', token],
    queryFn: () => apiFetch<TokenInfo>(API.tokenInfo(token)),
    retry: false,
  });
  if (query.isPending) return <p role="status">Carregando...</p>;
  if (query.isError) {
    if (isGone(query.error)) return <Expired />;
    return (
      <>
        <p role="alert" className="err">
          {messageOf(query.error)}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Tentar de novo
        </button>
      </>
    );
  }
  if (query.data.purpose !== purpose) return <Expired />;
  return <>{children(token, query.data)}</>;
}

export function TokenGate({ purpose, children }: Readonly<Props>) {
  const [params] = useSearchParams();
  const token = params.get('token');
  if (!token) return <Expired />;
  return (
    <TokenLookup token={token} purpose={purpose}>
      {children}
    </TokenLookup>
  );
}
