import { API } from '@fixable/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiRequestError, apiFetch } from '../api.ts';
import type { TokenGateProps, TokenInfo, TokenLookupProps } from '../../types/auth-screens.types.ts';
import { messageOf } from './form-errors.ts';
import { clearTokenFromUrl, tokenFromHash } from './token-url.ts';

export const EXPIRED_MESSAGE = 'Este link expirou ou já foi usado.';

/** Aviso de link expirado, com atalho para pedir outro. */
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

/** Informa se o erro é um 410, de link expirado ou já usado. */
function isGone(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === HTTP_GONE;
}

/** Consulta o token na API e mostra o conteúdo quando o link vale, ou o erro correspondente. */
function TokenLookup({ token, purpose, children }: Readonly<TokenLookupProps>) {
  const query = useQuery({
    queryKey: ['token-info', token],
    queryFn: () => apiFetch<TokenInfo>(API.tokenLookup, { method: 'POST', body: { token } }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const gone = query.isError && isGone(query.error);
  useEffect(() => {
    if (gone) clearTokenFromUrl();
  }, [gone]);
  if (query.isPending) return <p role="status">Carregando...</p>;
  if (query.isError) {
    if (gone) return <Expired />;
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

/** Lê o token do fragmento do link uma única vez, mantendo-o mesmo depois que a URL for limpa. */
function useTokenFromUrl(): string | null {
  const { hash } = useLocation();
  const [token] = useState(() => tokenFromHash(hash));
  return token;
}

/** Valida o token do link de convite ou redefinição e só então mostra o formulário com ele. */
export function TokenGate({ purpose, children }: Readonly<TokenGateProps>) {
  const token = useTokenFromUrl();
  if (!token) return <Expired />;
  return (
    <TokenLookup token={token} purpose={purpose}>
      {children}
    </TokenLookup>
  );
}
