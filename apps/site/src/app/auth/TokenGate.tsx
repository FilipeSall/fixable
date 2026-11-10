import { API } from '@fixable/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
    queryFn: () => apiFetch<TokenInfo>(API.tokenLookup, { method: 'POST', body: { token } }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
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

const TOKEN_PARAM = 'token';

/** Lê o token do link uma única vez e o tira da URL, para não vazar no Referer nem ficar no histórico. */
function useTokenFromUrl(): string | null {
  const [params, setParams] = useSearchParams();
  const [token] = useState(() => params.get(TOKEN_PARAM));
  useEffect(() => {
    if (!params.has(TOKEN_PARAM)) return;
    const next = new URLSearchParams(params);
    next.delete(TOKEN_PARAM);
    setParams(next, { replace: true });
  }, [params, setParams]);
  return token;
}

/** Valida o token do link de convite ou redefinição e só então mostra o formulário com ele. */
export function TokenGate({ purpose, children }: Readonly<Props>) {
  const token = useTokenFromUrl();
  if (!token) return <Expired />;
  return (
    <TokenLookup token={token} purpose={purpose}>
      {children}
    </TokenLookup>
  );
}
