import { API } from '@fixable/shared';
import type { Me } from '@fixable/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { ApiRequestError, apiFetch } from '../api.ts';
import type { AuthContextValue, AuthProviderProps } from '../../types/auth-screens.types.ts';

const HTTP_UNAUTHORIZED = 401;
const ME_KEY = ['me'];

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

/** Provê o usuário atual e as ações de login e logout para o app. */
export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ME_KEY, queryFn: fetchMe });

  const value = useMemo<AuthContextValue>(() => {
    /** Atualiza o usuário em cache, cancelando consultas em andamento. */
    async function setMe(me: Me | null) {
      await queryClient.cancelQueries({ queryKey: ME_KEY });
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
      await setMe(null);
    }
    return { me: query.data ?? null, isLoading: query.isPending, login, logout, setMe };
  }, [queryClient, query.data, query.isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Lê o contexto de autenticação e falha fora do AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
