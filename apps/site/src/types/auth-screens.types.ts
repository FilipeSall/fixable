import type { Me, Role } from '@fixable/shared';
import type { ReactNode } from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export type AuthContextValue = {
  me: Me | null;
  status: AuthStatus;
  retry: () => void;
  login: (email: string, senha: string) => Promise<Me>;
  logout: () => Promise<void>;
  setMe: (me: Me | null) => Promise<void>;
};

export type AuthProviderProps = { children: ReactNode };

export type RequireAuthProps = { roles?: Role[] };

export type FieldProps = {
  id: string;
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
};

export type SetPasswordFormProps = {
  submitLabel: string;
  busyLabel: string;
  onSubmit: (senha: string) => Promise<void>;
};

export type TokenInfo = {
  purpose: 'convite' | 'redefinicao';
  nome: string;
  email: string;
};

export type TokenGateProps = {
  purpose: TokenInfo['purpose'];
  children: (token: string, info: TokenInfo) => ReactNode;
};

export type TokenLookupProps = TokenGateProps & { token: string };

export type LocationState = { notice?: string };
