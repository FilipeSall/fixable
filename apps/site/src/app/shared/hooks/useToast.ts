import { createContext, useContext } from 'react';
import type { ToastContextValue } from '../../../types/platform-ui.types.ts';

export const ToastContext = createContext<ToastContextValue>({ show: () => undefined });

/** Dá acesso à função que mostra o aviso flutuante (toast) da plataforma. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
