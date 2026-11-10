import { API } from '@fixable/shared';
import type { Me } from '@fixable/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ApiRequestError, apiFetch } from '../api.ts';

const HTTP_UNAUTHORIZED = 401;
const ME_KEY = ['me'];

interface AuthContextValue {
  me: Me | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<Me>;
  logout: () => Promise<void>;
  setMe: (me: Me | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<Me | null> {
  try {
    return await apiFetch<Me>(API.me);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_UNAUTHORIZED) return null;
    throw error;
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ME_KEY, queryFn: fetchMe });

  const value = useMemo<AuthContextValue>(() => {
    async function setMe(me: Me | null) {
      await queryClient.cancelQueries({ queryKey: ME_KEY });
      queryClient.setQueryData(ME_KEY, me);
    }
    async function login(email: string, senha: string) {
      const me = await apiFetch<Me>(API.login, { method: 'POST', body: { email, senha } });
      await setMe(me);
      return me;
    }
    async function logout() {
      await apiFetch<void>(API.logout, { method: 'POST' });
      await setMe(null);
    }
    return { me: query.data ?? null, isLoading: query.isPending, login, logout, setMe };
  }, [queryClient, query.data, query.isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
