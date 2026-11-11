import { API } from '@fixable/shared';
import type { Me } from '@fixable/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ApiRequestError, apiFetch } from '../../api.ts';
import { ME_KEY } from './me-key.ts';
import { changesUser, clearPrivateQueries } from './session-cache.ts';
import type { AuthContextValue, AuthProviderProps, AuthStatus } from '../../../types/auth-screens.types.ts';

const HTTP_UNAUTHORIZED = 401;

const AuthContext = createContext<AuthContextValue | null>(null);

/** Consulta o usuário logado e devolve null quando não há sessão. */
async function fetchMe(): Promise<Me | null> {
  try {
    return await apiFetch<Me>(API.me);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_UNAUTHORIZED) return null;
    throw error;
  }
}

/** Traduz o estado da consulta de sessão: 401 vira anônimo, outra falha vira erro e nova tentativa volta a carregar. */
function statusOf(me: Me | null | undefined, isError: boolean, isFetching: boolean): AuthStatus {
  if (me) return 'authenticated';
  if (me === null) return 'anonymous';
  return isError && !isFetching ? 'error' : 'loading';
}

/** Provê o usuário atual e as ações de login e logout para o app. */
export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const queryClient = useQueryClient();
  const { data, isError, isFetching, refetch } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe });
  const identityRef = useRef<string | null | undefined>(undefined);
  const loggedOutRef = useRef(false);

  useEffect(() => {
    if (data === undefined) return;
    if (data) loggedOutRef.current = false;
    const identity = data?.id ?? null;
    const previous = identityRef.current;
    identityRef.current = identity;
    if (changesUser(previous, identity)) void clearPrivateQueries(queryClient);
  }, [data, queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    /** Atualiza o usuário em cache, descartando os dados do usuário anterior quando a sessão muda de dono. */
    async function setMe(me: Me | null) {
      const identity = me?.id ?? null;
      const previous = queryClient.getQueryData<Me | null>(ME_KEY)?.id ?? identityRef.current;
      if (changesUser(previous, identity)) await clearPrivateQueries(queryClient);
      else await queryClient.cancelQueries({ queryKey: ME_KEY });
      identityRef.current = identity;
      if (me) loggedOutRef.current = false;
      queryClient.setQueryData(ME_KEY, me);
    }
    /** Faz login pela API e guarda o usuário. */
    async function login(email: string, senha: string) {
      const me = await apiFetch<Me>(API.login, { method: 'POST', body: { email, senha } });
      await setMe(me);
      return me;
    }
    /** Encerra a sessão pela API e limpa o usuário em cache. */
    async function logout() {
      await apiFetch<void>(API.logout, { method: 'POST' });
      loggedOutRef.current = true;
      await setMe(null);
    }
    /** Consulta a sessão de novo depois de uma falha que não foi 401. */
    function retry() {
      void refetch();
    }
    /** Diz se a sessão acabou porque o usuário clicou em Sair (e não por expirar). */
    function endedByLogout() {
      return loggedOutRef.current;
    }
    return { me: data ?? null, status: statusOf(data, isError, isFetching), retry, login, logout, setMe, endedByLogout };
  }, [queryClient, data, isError, isFetching, refetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Lê o contexto de autenticação e falha fora do AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
